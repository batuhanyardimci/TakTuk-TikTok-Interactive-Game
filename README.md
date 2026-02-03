# TakTuk - Interactive TikTok Boss Fight Game

TakTuk is an interactive web-based game where TikTok live stream viewers can battle against bosses by interacting with the stream. The game is built using **Phaser 3** for the game engine and **Node.js** with **Socket.io** for the backend to handle real-time TikTok events.

## 🎮 Game Mechanics

The goal is to defeat the boss of each level to progress. Viewers become "Warriors" in the game and fight on your behalf.

### Viewer Interactions
- **Like the Stream**: Spawns a **Small Warrior** (Kamikaze unit).
    - *Stats*: Low HP, Low Damage, Dies on impact.
- **Send a Gift**: Spawns a **Heavy Warrior** (Golden unit).
    - *Stats*: High HP, High Damage, Invincible for several hits.
    - *Visual*: Appears in gold/shiny armor with a name tag.

### Game Features
- **5 Unique Levels**: Forest, Ice, Desert, Dungeon, and Volcano themes.
- **Dynamic Bosses**: Each level has a unique boss (Slime, Yeti, Scorpion, Skeleton, Dragon) that scales in size and difficulty.
- **Visual Effects**: Screen shake, boss damage flash, and particle effects.
- **Level Transitions**: Shows a transition screen with the "Top 3 Damage Dealers" before the next level starts.
- **Live Leaderboard**: Real-time tracking of "Critical Hitters" (Gifters) and "Damage Dealers" (Likers) displayed at the top of the screen.

## 🛠️ Technology Stack

- **Frontend**: Phaser 3 (JavaScript)
- **Backend**: Node.js, Express, Socket.io
- **Integration**: `tiktok-live-connector` (to fetch real-time stream events)
- **Assets**: Pixel art sprites and backgrounds.

## 🚀 Installation & Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/batuhanyardimci/TakTuk-TikTok-Interactive-Game.git
    cd TakTuk
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start the Backend Server**:
    This handles the TikTok connection and Socket.io events.
    ```bash
    npm run server
    ```
    *Runs on `http://localhost:3000`*

4.  **Start the Game Client**:
    This launches the Phaser game.
    ```bash
    npm run dev
    ```
    *Runs on `http://localhost:5173` (or similar)*

## 🕹️ How to Play (Streamer Guide)

1.  Open the game in your browser (usually `http://localhost:5173`).
2.  Enter your **TikTok Username** (`@username`) in the connect form at the top left.
3.  Click **Connect**.
4.  Once connected, your viewers' actions will automatically spawn warriors in the game!
    - **Likes** -> Small Warriors
    - **Gifts** -> Big Warriors
5.  Defeat the boss to advance to the next level!

## 📂 Project Structure

- `src/scenes/`
    - `BootScene.js`: Preloads assets (images, spritesheets).
    - `GameScene.js`: Main game loop, logic, physics, and socket listeners.
- `server/`
    - `index.js`: Express server and TikTok connector logic.
- `public/assets/`: Stores game assets (images, audio).

## 🤝 Contributing

Feel free to open issues or submit pull requests if you have ideas for new bosses, features, or optimizations!

---

*Verified Working on Windows 10/11 & Node.js 18+*
