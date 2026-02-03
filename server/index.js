const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../dist')));

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let tiktokConnection = null;

    socket.on('join-chat', (tiktokUsername) => {
        if (!tiktokUsername) return;

        // Clean up existing connection if any
        if (tiktokConnection) {
            try {
                tiktokConnection.disconnect();
            } catch (e) {
                console.error("Error connecting", e)
            }
        }

        console.log(`Connecting to TikTok user: ${tiktokUsername}`);
        tiktokConnection = new WebcastPushConnection(tiktokUsername);

        tiktokConnection.connect().then(state => {
            console.log(`Connected to room ${state.roomId}`);
            socket.emit('tiktok-connected', { roomId: state.roomId });
        }).catch(err => {
            console.error('Failed to connect', err);
            socket.emit('tiktok-disconnected', { error: err.message || "Failed to connect" });
        });

        // Events
        // Events
        tiktokConnection.on('follow', (data) => {
            console.log('EVENT: New Follower:', data.nickname);
            socket.emit('like', {
                user: data.nickname || data.uniqueId,
                count: 10, // Follow counts as 10 likes? Or simple like. Let's make it 5 damage.
                isFollow: true
            });
        });

        tiktokConnection.on('like', (data) => {
            console.log('EVENT: Like:', data.nickname, data.likeCount);
            // Simplified: emit 'like' with count 1 for every event for now.
            socket.emit('like', {
                user: data.nickname,
                count: 1, // Assume 1 click = 1 like event roughly
                profilePictureUrl: data.profilePictureUrl
            });
        });

        tiktokConnection.on('gift', (data) => {
            // Only process if it's the end of a streak or a non-streak gift to avoid spam
            if (data.giftType === 1 && !data.repeatEnd) {
                return;
            }
            console.log('EVENT: Gift:', data.giftName, 'from', data.nickname);
            socket.emit('gift', {
                user: data.nickname,
                giftName: data.giftName,
                count: data.repeatCount,
                icon: data.giftIcon,
                diamondCost: data.diamondCount, // useful for damage scaling
                profilePictureUrl: data.profilePictureUrl
            });
        });

        tiktokConnection.on('chat', (data) => {
            console.log(`EVENT: Chat: ${data.nickname} says: ${data.comment}`);
            // Debugging: Allow manual damage via chat
            if (data.comment.includes('!hit')) {
                socket.emit('like', { user: 'Debug', count: 50 });
            }
        });

        tiktokConnection.on('error', (err) => {
            console.error('EVENT: Error:', err);
        });

        tiktokConnection.on('streamEnd', () => {
            socket.emit('tiktok-disconnected', { reason: 'Stream ended' });
        });
    });

    socket.on('disconnect', () => {
        if (tiktokConnection) {
            tiktokConnection.disconnect();
        }
        console.log('Client disconnected');
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
