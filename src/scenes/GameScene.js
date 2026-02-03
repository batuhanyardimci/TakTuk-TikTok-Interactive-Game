import Phaser from 'phaser';
import { io } from 'socket.io-client';

class Warrior extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type, user) {
        const texture = type === 'big' ? 'heavy_warrior_sheet' : 'warrior_sheet';
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.allowGravity = false; // Prevent falling if gravity is on

        this.type = type; // 'small' or 'big'
        this.user = user;
        this.target = null;
        this.isAttacking = false;
        this.hasHit = false;
        this.isDying = false;
        this.hitCount = 0;
        this.maxHits = (type === 'big') ? 4 : 1;

        // Stats
        if (type === 'big') {
            this.setScale(1.2);
            this.hp = 3;
            this.damage = 50; // Critical damage per hit
            this.setTint(0xffd700); // Gold for Gift
        } else {
            this.setScale(0.8); // Slightly bigger for visibility
            this.hp = 1;
            this.damage = 1; // Like damage
        }

        // Start Walking Animation
        const walkAnim = type === 'big' ? 'heavy-walk' : 'warrior-walk';
        this.play(walkAnim, true);

        // Visual
        this.nameText = scene.add.text(x, y - 20, user, {
            fontSize: '16px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // AI - Speed randomization
        this.moveSpeed = Phaser.Math.Between(60, 120);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.nameText) {
            // Position above head, but closer
            this.nameText.setPosition(this.x, this.y - (this.displayHeight / 2) - 5);
        }

        // Simple AI: Move to target (Boss Center)
        if (this.target && this.target.active && !this.isAttacking) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);

            // Ensure walk animation
            const walkAnim = this.type === 'big' ? 'heavy-walk' : 'warrior-walk';
            if (this.anims.currentAnim && this.anims.currentAnim.key !== walkAnim) {
                this.play(walkAnim, true);
            }

            if (dist < 100) { // Attack Range
                this.setVelocity(0);
                this.startAttack();
            } else {
                this.scene.physics.moveToObject(this, this.target, this.moveSpeed);
                // Flip Logic
                if (this.target.x < this.x) this.setFlipX(true);
                else this.setFlipX(false);
            }
        } else if (!this.target || !this.target.active) {
            this.setVelocity(0);
        }

        // Failsafe: Prevent any gravity/falling
        if (!this.body) return;
        this.body.setAllowGravity(false);
        if (this.isAttacking) {
            this.setVelocity(0, 0);
        }
    }

    startAttack() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.setVelocity(0, 0);

        // Immediate Attack
        this.performAttack();

        // If died (small warrior), return immediately
        if (!this.active) return;

        // Timer for repeated attacks
        this.attackTimer = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.performAttack();
            }
        });
    }

    performAttack() {
        if (!this.active || !this.target || !this.target.active) return;

        // Play Attack Animation
        const attackAnim = this.type === 'big' ? 'heavy-attack' : 'warrior-attack';
        this.play(attackAnim, true);

        // Visual Lunge (Horizontal only to prevent "falling" look)
        this.scene.tweens.add({
            targets: this,
            x: this.x + (this.flipX ? -20 : 20),
            duration: 100,
            yoyo: true
        });

        // Deal Damage
        console.log(`Warrior ${this.user} attacking Boss for ${this.damage} damage`);
        if (this.scene && this.scene.damageBoss) {
            this.hitCount++;

            // Handle Death Logic per type
            let shouldDie = false;

            if (this.type !== 'big') {
                // Small: Die after 1 hit
                shouldDie = true;
            } else {
                // Big: Die after 4 hits
                if (this.hitCount >= 4) {
                    shouldDie = true;
                }
            }

            // Mark as dying if about to die (prevent retaliation death)
            if (shouldDie) {
                this.isDying = true;
            }

            this.hasHit = true;
            this.scene.damageBoss(this.damage, this.user, this.type === 'big');

            // If died during damageBoss (due to instant retaliation), stop here
            if (!this.active || !this.scene) return;

            // Trigger Death
            if (shouldDie) {
                this.once('animationcomplete', () => {
                    this.die();
                });
                // Fallback
                this.scene.time.delayedCall(500, () => {
                    if (this.active) this.die();
                });
            }
        } else {
            console.error('Scene or damageBoss method missing');
        }
    }

    takeDamage(amount) {
        if (this.isDying) return;

        // Big Warriors are invincible to Boss Damage until they finish their hits
        if (this.type === 'big' && this.hitCount < 4) {
            // Just flash gold/red interaction
            this.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => {
                if (this.active) this.setTint(0xffd700);
            });
            return;
        }

        this.hp -= amount;
        if (this.hp <= 0) {
            this.die();
        } else {
            // Flash red
            this.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => {
                if (this.active) this.clearTint();
                if (this.type === 'big') this.setTint(0xffd700); // Restore Gold tint
            });
        }
    }

    die() {
        if (this.attackTimer) this.attackTimer.remove();
        if (this.nameText) this.nameText.destroy();
        this.destroy();
    }
}

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.socket = null;
        this.isConnected = false;
        this.warriors = null;

        // Game State
        this.currentLevelIndex = 0;
        this.levels = [
            100, 250, 500, 2000, 5000,
            10000, 30000, 50000, 100000, 200000
        ];

        // Level Assets Config
        this.levelAssets = [
            { bg: 'bg_forest', boss: 'boss_forest' },
            { bg: 'bg_ice', boss: 'boss_ice' },
            { bg: 'bg_desert', boss: 'boss_desert' },
            { bg: 'bg_dungeon', boss: 'boss_dungeon' },
            { bg: 'bg_volcano', boss: 'boss_volcano' }
        ];

        this.maxHP = this.levels[0];
        this.currentHP = this.levels[0];

        // Mechanics
        this.bossAttackTimer = 0;

        // Visuals
        this.background = null;
        this.boss = null;
        this.hpFrame = null;
        this.hpBar = null;
        this.hpText = null;
        this.levelText = null;
        this.visualState = 'normal'; // normal, angry, shake, slowmo

        // Leaderboards
        this.topLikers = new Map();
        this.topGifters = new Map();

        // Level Transition Data
        this.levelDamage = new Map(); // Tracks current level damage only
        this.userAvatars = new Map(); // Stores avatar URLs by username
        this.isTransitioning = false;
    }

    create() {
        // --- Socket Setup ---
        // Connect directly to backend port 3000
        this.socket = io('http://localhost:3000');
        this.setupSocketListeners();

        // --- Visual Setup ---
        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;
        this.groundY = this.cameras.main.height - 150; // Ground Level anchored

        // 1. Background (Centered and Scaled)
        // Default to first level
        const assetConfig = this.levelAssets[0];
        this.background = this.add.image(cx, cy, assetConfig.bg);
        // Scale to cover
        const scaleX = this.cameras.main.width / this.background.width;
        const scaleY = this.cameras.main.height / this.background.height;
        const scale = Math.max(scaleX, scaleY);
        this.background.setScale(scale).setScrollFactor(0);

        // 2. Boss Sprite
        this.boss = this.physics.add.sprite(cx, this.groundY, assetConfig.boss);
        this.boss.setOrigin(0.5, 1); // Anchor to bottom center so they stand ON the ground

        // Normalize Size (Target Height ~250px)
        const targetHeight = 250;
        const bossScale = targetHeight / this.boss.height;
        this.boss.setScale(bossScale);

        this.boss.setImmovable(true);
        this.boss.body.allowGravity = false;

        // If it's a spritesheet, play idle
        if (this.anims.exists('goomba-walk')) {
            this.boss.play('goomba-walk');
        }

        // Warrior Animations
        if (!this.anims.exists('warrior-walk')) {
            this.anims.create({
                key: 'warrior-walk',
                frames: this.anims.generateFrameNumbers('warrior_sheet', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.anims.exists('warrior-attack')) {
            this.anims.create({
                key: 'warrior-attack',
                frames: this.anims.generateFrameNumbers('warrior_sheet', { start: 4, end: 7 }),
                frameRate: 12,
                repeat: -1
            });
        }

        // Heavy Warrior Animations
        if (!this.anims.exists('heavy-walk')) {
            this.anims.create({
                key: 'heavy-walk',
                frames: this.anims.generateFrameNumbers('heavy_warrior_sheet', { start: 0, end: 3 }),
                frameRate: 6, // Slower, heavier walk
                repeat: -1
            });
        }
        if (!this.anims.exists('heavy-attack')) {
            this.anims.create({
                key: 'heavy-attack',
                frames: this.anims.generateFrameNumbers('heavy_warrior_sheet', { start: 4, end: 7 }),
                frameRate: 10, // Powerful swings
                repeat: -1
            });
        }

        // --- Warrior Group ---
        this.warriors = this.physics.add.group({
            classType: Warrior,
            runChildUpdate: true
        });

        // --- UI Layer ---
        const topY = 60;
        const frameScale = 0.5; // Smaller as requested

        // HP Frame (Ornate) - Reference for sizing
        // Frame at 0.5 scale. Inner opening estimation.

        // HP Bar Background (Darker)
        // Adjusted to fit inside the scaled frame
        const barWidth = 360; // estimate for 0.5 scale
        const barHeight = 32; // Taller to fill the vertical space
        this.add.rectangle(cx, topY, barWidth, barHeight, 0x111111).setScrollFactor(0);

        // HP Bar Fill (Vibrant Red)
        this.hpBar = this.add.rectangle(cx - (barWidth / 2), topY, barWidth, barHeight, 0xff0000).setScrollFactor(0);
        this.hpBar.setOrigin(0, 0.5); // Anchor left
        this.hpBarMaxWidth = barWidth; // Store for update

        // HP Frame (Ornate) - Added AFTER bar to be on top
        this.hpFrame = this.add.image(cx, topY, 'ui_hp_frame').setScrollFactor(0);
        this.hpFrame.setScale(frameScale);

        // Level Text (Styled)
        this.levelText = this.add.text(cx, topY - 50, `LEVEL ${this.currentLevelIndex + 1}`, {
            fontSize: '20px', // Smaller font
            fontFamily: '"Press Start 2P", "Segoe UI", sans-serif',
            fontStyle: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true }
        }).setOrigin(0.5);

        // HP Text
        this.hpText = this.add.text(cx, topY, `${this.currentHP}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Click Handler (Manual Spawn Debug)
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                this.spawnWarrior('big', 'Gifter');
            } else {
                this.spawnWarrior('small', 'Clicker');
            }
        });

        // Prevent context menu
        this.input.mouse.disableContextMenu();
    }

    setupSocketListeners() {
        const connectBtn = document.getElementById('connect-btn');
        const usernameInput = document.getElementById('username');
        const statusDiv = document.getElementById('status');

        if (connectBtn) {
            // Clone to remove old listeners
            const newBtn = connectBtn.cloneNode(true);
            connectBtn.parentNode.replaceChild(newBtn, connectBtn);

            newBtn.addEventListener('click', () => {
                const username = usernameInput.value;
                if (username) {
                    if (statusDiv) statusDiv.innerText = 'Connecting...';
                    this.socket.emit('join-chat', username);
                }
            });
        }

        this.socket.on('tiktok-connected', (data) => {
            this.isConnected = true;
            if (statusDiv) {
                statusDiv.innerText = `Connected: ${data.roomId}`;
                statusDiv.style.color = '#0f0';
            }
        });

        this.socket.on('tiktok-disconnected', () => {
            this.isConnected = false;
            if (statusDiv) statusDiv.style.color = '#f00';
        });

        this.socket.on('like', (data) => {
            if (this.isTransitioning) return; // Ignore events during transition
            // Store Avatar
            if (data.profilePictureUrl) {
                this.userAvatars.set(data.user, data.profilePictureUrl);
            }
            // Spawn Small Warriors
            this.spawnWarrior('small', data.user);
        });

        this.socket.on('gift', (data) => {
            if (this.isTransitioning) return;
            // Store Avatar
            if (data.profilePictureUrl) {
                this.userAvatars.set(data.user, data.profilePictureUrl);
            }
            // Spawn Big Warrior
            this.spawnWarrior('big', data.user);
        });
    }

    spawnWarrior(type, user) {
        // Spawn from edges (Left or Right only for "Ground" approach)
        const w = this.cameras.main.width;
        const offset = 100; // Spawn further out so they walk in

        // Random Side: Left or Right
        const isLeft = Phaser.Math.Between(0, 1) === 0;
        const x = isLeft ? -offset : w + offset;

        // Y Position: On the ground with slight variation for depth
        // Ensure this.groundY is defined, fallback if not
        const groundLevel = this.groundY || (this.cameras.main.height - 150);
        const y = groundLevel + Phaser.Math.Between(-20, 20);

        const warrior = new Warrior(this, x, y, type, user);
        warrior.target = this.boss;

        // Ensure they face the boss initially (though update logic handles this)
        warrior.setFlipX(!isLeft); // If left (x < 0), logic in update sets flip.

        this.warriors.add(warrior);
    }

    damageBoss(amount, user, isCrit = false) {
        if (this.currentHP <= 0) return;

        this.currentHP -= amount;
        if (this.currentHP < 0) this.currentHP = 0;

        // Visual Layout Update
        this.updateHPBar();

        // Effect
        this.spawnDamageText(amount, isCrit);

        // Leaderboard Update (Global)
        if (isCrit) {
            this.updateLeaderboard(this.topGifters, user, amount, 'lb-gifts');
        } else {
            this.updateLeaderboard(this.topLikers, user, amount, 'lb-likes');
        }

        // Track Level Damage (Local)
        const currentLvlDmg = this.levelDamage.get(user) || 0;
        this.levelDamage.set(user, currentLvlDmg + amount);

        // Boss Reaction (Shake & Flash)
        this.tweens.add({
            targets: this.boss,
            angle: { from: -5, to: 5 },
            duration: 50,
            yoyo: true,
            repeat: 1
        });

        // Flash White/Red
        this.boss.setTint(0xffaaaa);
        this.time.delayedCall(100, () => {
            if (this.boss && this.boss.active) {
                this.boss.clearTint();
            }
        });

        // Instant Retaliation: Boss attacks back immediately when hit
        this.bossAttackLogic();

        if (this.currentHP <= 0) {
            this.showLevelTransition();
        }
    }

    update(time, delta) {
        // Boss Attack Logic
        // Find warriors in range
        if (time > this.bossAttackTimer) {
            this.bossAttackLogic();
            this.bossAttackTimer = time + 1000; // Attack every 1s
        }
    }

    bossAttackLogic() {
        if (!this.warriors || this.warriors.getLength() === 0) return;

        // Get warriors close to boss
        const range = 150;
        const targets = this.warriors.getChildren().filter(w => {
            return w.active && w.hasHit && Phaser.Math.Distance.Between(this.boss.x, this.boss.y, w.x, w.y) < range;
        });

        if (targets.length > 0) {
            // Attack Animation (Shake/Pulse)
            this.tweens.add({
                targets: this.boss,
                angle: { from: -10, to: 10 },
                duration: 100,
                yoyo: true,
                repeat: 3
            });

            this.cameras.main.shake(100, 0.005);

            // Damage ALL targets in range
            targets.forEach(t => {
                t.takeDamage(1);
            });
        }
    }

    updateHPBar() {
        const pct = this.currentHP / this.maxHP;
        this.hpBar.width = (this.hpBarMaxWidth || 360) * pct;
        this.hpText.setText(`${this.currentHP} / ${this.maxHP}`);

        if (pct <= 0.30) {
            this.physics.world.timeScale = 0.5;
            if (this.visualState !== 'slowmo') {
                this.visualState = 'slowmo';
                this.cameras.main.flash(500, 255, 0, 0);
            }
        } else if (pct <= 0.50) {
            this.visualState = 'shake';
        } else if (pct <= 0.75) {
            this.boss.setTint(0xff0000);
            this.visualState = 'angry';
        } else {
            this.boss.clearTint();
            this.physics.world.timeScale = 1.0;
            this.visualState = 'normal';
        }
    }

    showLevelTransition() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Kill all warriors
        this.warriors.clear(true, true);

        // Calculate Top 3 for this level
        const sorted = [...this.levelDamage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

        // Populate HTML Layout
        const container = document.querySelector('.top-players');
        if (container) {
            container.innerHTML = sorted.map((entry, index) => {
                const user = entry[0];
                const score = entry[1];
                const avatar = this.userAvatars.get(user) || 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7342740037592932358~c5_100x100.jpeg?x-expires=1708128000&x-signature=8J%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B%2B&shcp=1'; // Fallback
                const rank = index + 1;

                return `
                <div class="player-card rank-${rank}">
                    <img src="${avatar}" class="avatar">
                    <div class="name">${user}</div>
                    <div class="score">${score} DMG</div>
                </div>
                `;
            }).join('');
        }

        // Show Overlay
        document.getElementById('level-transition').classList.remove('hidden');

        // Timer Logic
        let timeLeft = 10;
        const timerSpan = document.getElementById('transition-timer');
        if (timerSpan) timerSpan.innerText = timeLeft;

        const countdown = setInterval(() => {
            timeLeft--;
            if (timerSpan) timerSpan.innerText = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(countdown);
                this.nextLevel();
            }
        }, 1000);
    }

    nextLevel() {
        // Hide Overlay
        document.getElementById('level-transition').classList.add('hidden');
        this.isTransitioning = false;

        // Reset Level Damage Map
        this.levelDamage.clear();

        this.currentLevelIndex++;

        // Victory Condition or Infinite Loop? Let's loop assets but keep levels
        // If levels run out, just keep multiplying HP? For now, just restart index if needed, but let's stick to array.
        if (this.currentLevelIndex >= this.levels.length) {
            this.levelText.setText("VICTORY!");
            // Optional: Reset game
            this.scene.restart(); // Simple restart for now
            return;
        }

        this.cameras.main.flash(1000, 255, 255, 255);
        this.levelText.setText(`LEVEL ${this.currentLevelIndex + 1}`);

        // Update Assets
        const assetIndex = this.currentLevelIndex % this.levelAssets.length;
        const assetConfig = this.levelAssets[assetIndex];

        // 1. Background
        this.background.setTexture(assetConfig.bg);
        // Re-scale
        const scaleX = this.cameras.main.width / this.background.width;
        const scaleY = this.cameras.main.height / this.background.height;
        const scale = Math.max(scaleX, scaleY);
        this.background.setScale(scale);

        // 2. Boss
        this.boss.setTexture(assetConfig.boss);
        this.boss.setOrigin(0.5, 1); // Anchor bottom

        // Normalize Size (Target Height ~250px)
        const targetHeight = 250;
        const bossScale = targetHeight / this.boss.height;
        this.boss.setScale(bossScale);
        // Play idle if exists (optional, if we add unique anims later)


        this.maxHP = this.levels[this.currentLevelIndex];
        this.currentHP = this.maxHP;
        this.updateHPBar();

        // Kill all warriors
        this.warriors.clear(true, true);
    }

    spawnDamageText(amount, isCrit) {
        const x = this.boss.x + Phaser.Math.Between(-50, 50);
        const y = this.boss.y + Phaser.Math.Between(-50, 50);
        const style = isCrit ?
            { fontSize: '48px', color: '#ff0000', fontStyle: 'bold' } :
            { fontSize: '24px', color: '#ffffff' };

        const text = this.add.text(x, y, `-${amount}`, style).setOrigin(0.5);
        this.tweens.add({
            targets: text, y: y - 100, alpha: 0, duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    updateLeaderboard(map, user, score, elementId) {
        if (!user) return;
        const current = map.get(user) || 0;
        map.set(user, current + score);
        const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const container = document.getElementById(elementId);
        if (container) {
            container.innerHTML = sorted.map((entry, i) => `
                <div class="lb-item">
                    <span style="color: ${i === 0 ? '#ffd700' : (i === 1 ? '#c0c0c0' : (i === 2 ? '#cd7f32' : 'white'))}">${entry[0]}</span>
                    <span class="lb-score">${entry[1]}</span>
                </div>
            `).join('');
        }
    }
}
