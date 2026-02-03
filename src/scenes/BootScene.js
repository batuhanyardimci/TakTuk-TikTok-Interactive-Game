import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        console.log('BootScene: Preloading assets...');
        this.load.setBaseURL('/');

        // Load images directly
        this.load.image('player', 'assets/miniwarrior.png');

        // Level Backgrounds
        this.load.image('bg_forest', 'assets/levels/forest_bg.png');
        this.load.image('bg_ice', 'assets/levels/ice_bg.png');
        this.load.image('bg_desert', 'assets/levels/desert_bg.png');
        this.load.image('bg_dungeon', 'assets/levels/dungeon_bg.png');
        this.load.image('bg_volcano', 'assets/levels/volcano_bg.png');

        // Level Bosses
        this.load.image('boss_forest', 'assets/bosses/forest_boss.png');
        this.load.image('boss_ice', 'assets/bosses/ice_boss.png');
        this.load.image('boss_desert', 'assets/bosses/desert_boss.png');
        this.load.image('boss_dungeon', 'assets/bosses/dungeon_boss.png');
        this.load.image('boss_volcano', 'assets/bosses/volcano_boss.png');

        // UI
        this.load.image('ui_hp_frame', 'assets/ui/hp_frame.png');

        // Load as image first to inspect dimensions
        this.load.image('warrior_raw', 'assets/warrior_sheet.png');
        this.load.image('heavy_warrior_raw', 'assets/warriors/heavy_warrior.png');

        // Just use tiles as ground for now
        this.load.image('ground', 'assets/tiles.jpg');

        // Effects
        this.load.image('particle', 'assets/particle.png');

        this.load.on('loaderror', (file) => {
            console.error('Error loading asset:', file.key, file.src);
        });
    }

    create() {
        console.log('BootScene: Create started');

        // --- Dynamic Spritesheet Creation ---
        // 1. Standard Warrior
        if (this.textures.exists('warrior_raw')) {
            const img = this.textures.get('warrior_raw').getSourceImage();
            const frameWidth = Math.floor(img.width / 4);
            const frameHeight = Math.floor(img.height / 2); // Assuming 2 rows based on prompt (Walk, Attack)

            console.log(`Creating warrior_sheet: ${img.width}x${img.height} -> Frame: ${frameWidth}x${frameHeight}`);

            // Create the spritesheet texture
            this.textures.addSpriteSheet('warrior_sheet', img, {
                frameWidth: frameWidth,
                frameHeight: frameHeight
            });
        }

        // 2. Heavy Warrior
        if (this.textures.exists('heavy_warrior_raw')) {
            const img = this.textures.get('heavy_warrior_raw').getSourceImage();
            const frameWidth = Math.floor(img.width / 4);
            const frameHeight = Math.floor(img.height / 2); // Assuming 2 rows based on prompt (Walk, Attack)

            console.log(`Creating heavy_warrior_sheet: ${img.width}x${img.height} -> Frame: ${frameWidth}x${frameHeight}`);

            // Create the spritesheet texture
            this.textures.addSpriteSheet('heavy_warrior_sheet', img, {
                frameWidth: frameWidth,
                frameHeight: frameHeight
            });
        }

        // Check if assets loaded, else create fallbacks
        if (!this.textures.exists('player')) this.createFallbackTexture('player', 0x00ff00);
        if (!this.textures.exists('monster')) this.createFallbackTexture('monster', 0xff0000);
        if (!this.textures.exists('ground')) this.createFallbackTexture('ground', 0x8B4513);

        // Effects
        if (!this.textures.exists('heart')) this.createFallbackTexture('heart', 0xff00ff);
        if (!this.textures.exists('particle')) this.createFallbackTexture('particle', 0xffff00);

        console.log('Textures ready. Starting GameScene');
        this.scene.start('GameScene');
    }

    createFallbackAssets() {
        this.createFallbackTexture('ground', 0x8B4513);
    }

    createFallbackTexture(key, color) {
        if (!this.textures.exists(key)) {
            console.warn(`Creating fallback for ${key}`);
            const graphics = this.make.graphics().fillStyle(color).fillRect(0, 0, 32, 32);
            graphics.generateTexture(key, 32, 32);
            graphics.destroy();
        }
    }
}
