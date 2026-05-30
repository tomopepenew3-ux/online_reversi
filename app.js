const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3001;

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// 【ここを追加！】普通のトップページ（/）にアクセスしたときは最初の画面を出す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// URLの直打ち（例: /1 や /ayw1u）に対応するためのルート設定
// publicの中に該当するファイルがなければ、index.htmlを返すようにする
app.get('/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 部屋ごとのプレイヤー管理
const rooms = {};

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 部屋に入る処理
    socket.on('joinRoom', (roomName) => {
        if (!roomName) roomName = 'lobby'; // 部屋名がない場合はロビー
        
        socket.join(roomName);
        socket.currentRoom = roomName;

        if (!rooms[roomName]) {
            rooms[roomName] = [];
        }

        const roomPlayers = rooms[roomName];

        if (roomPlayers.length < 2) {
            // 1人目は黒、2人目は白
            const color = roomPlayers.length === 0 ? 'black' : 'white';
            roomPlayers.push({ id: socket.id, color: color });
            
            socket.emit('initColor', color);
            console.log(`部屋 [${roomName}] にプレイヤー登録:`, color);

            if (roomPlayers.length === 2) {
                io.to(roomName).emit('gameStatus', { message: '対戦スタート！' });
            } else {
                io.to(roomName).emit('gameStatus', { message: '対戦相手を待っています... (1/2)' });
            }
        } else {
            // 3人目以降は観戦
            socket.emit('initColor', 'spectator');
            socket.emit('gameStatus', { message: '満員のため観戦モードです' });
        }
    });

    socket.on('disconnect', () => {
        const roomName = socket.currentRoom;
        console.log('ユーザーの接続が切れました:', socket.id);
        
        if (roomName && rooms[roomName]) {
            rooms[roomName] = rooms[roomName].filter(p => p.id !== socket.id);
            if (rooms[roomName].length === 0) {
                delete rooms[roomName];
            } else {
                io.to(roomName).emit('gameStatus', { message: '対戦相手の接続が切れました。相手の再接続を待っています。' });
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Online Server is running on port ${port}`);
});
