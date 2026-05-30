const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = 3001;

// 静的ファイルの配信設定
app.use(express.static(__dirname));

// ルーティング設定（ルーム名付きURLへのアクセス処理）
app.get('/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ルームごとの接続プレイヤー管理オブジェクト
const rooms = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    // 入室要求時の処理
    socket.on('joinRoom', (data) => {
        const { roomName, userName } = data;
        currentRoom = roomName;
        socket.join(roomName);

        // ルームの初期化
        if (!rooms[roomName]) {
            rooms[roomName] = [];
        }

        // プレイヤー情報の格納
        rooms[roomName].push({ id: socket.id, name: userName });
        const playerIndex = rooms[roomName].length;

        if (playerIndex === 1) {
            // 1人目：白猫（先手）を割り当て
            socket.emit('assignColor', 2); 
            socket.emit('waiting', '対戦相手を待っています...');
        } else if (playerIndex === 2) {
            // 2人目：黒猫（後手）を割り当て
            socket.emit('assignColor', 1);

            const player1 = rooms[roomName][0];
            const player2 = rooms[roomName][1];

            // 双方のクライアントへ対戦相手の名前を通知して開始
            io.to(player1.id).emit('start', { opponentName: player2.name });
            io.to(player2.id).emit('start', { opponentName: player1.name });
        } else {
            // 3人目以降：満員エラーとして処理
            socket.emit('full', 'この部屋は満員です。');
            socket.leave(roomName);
        }
    });

    // 着手情報のブロードキャスト処理
    socket.on('makeMove', (data) => {
        if (currentRoom) {
            io.to(currentRoom).emit('updateBoard', data);
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            // 切断されたプレイヤーをリストから除外
            rooms[currentRoom] = rooms[currentRoom].filter(p => p.id !== socket.id);
            io.to(currentRoom).emit('opponentDisconnected', '対戦相手が切断されました。');
            
            // ルームが空になった場合はオブジェクトから削除
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Online Server is running on port ${PORT}`);
});
