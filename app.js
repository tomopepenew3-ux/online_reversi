const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = 3001;

// オンラインリバーシのファイルを読み込む設定
app.use(express.static(__dirname));

// ルーム名付きのURL（例: /abcde）にアクセスされたら、index.html を返す
app.get('/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 各部屋のプレイヤー情報を管理するオブジェクト
const rooms = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    // 部屋に入る合図を受け取ったとき（名前も一緒に届くよ！）
    socket.on('joinRoom', (data) => {
        const { roomName, userName } = data;
        currentRoom = roomName;
        socket.join(roomName);

        // まだ部屋が存在しなかったら新しく作る
        if (!rooms[roomName]) {
            rooms[roomName] = [];
        }

        // 部屋にプレイヤーの名前とIDを登録
        rooms[roomName].push({ id: socket.id, name: userName });
        const playerIndex = rooms[roomName].length;

        if (playerIndex === 1) {
            // 1人目は白猫（2）
            socket.emit('assignColor', 2); 
            socket.emit('waiting', '対戦相手を待っています...');
        } else if (playerIndex === 2) {
            // 2人目は黒猫（1）
            socket.emit('assignColor', 1);

            // 1人目（Aさん）と2人目（Bさん）の情報を取得
            const player1 = rooms[roomName][0];
            const player2 = rooms[roomName][1];

            // Aさん（白猫）には、Bさん（黒猫）の名前を教えてゲーム開始！
            io.to(player1.id).emit('start', { opponentName: player2.name });

            // Bさん（黒猫）には、Aさん（白猫）の名前を教えてゲーム開始！
            io.to(player2.id).emit('start', { opponentName: player1.name });
        } else {
            // 3人目以降は満員エラー
            socket.emit('full', 'この部屋は満員です。');
            socket.leave(roomName);
        }
    });

    // コマが置かれたときの合図
    socket.on('makeMove', (data) => {
        if (currentRoom) {
            io.to(currentRoom).emit('updateBoard', data);
        }
    });

    // 接続が切れたとき
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            // 抜けた人をリストから削除
            rooms[currentRoom] = rooms[currentRoom].filter(p => p.id !== socket.id);
            // 残された相手に通知
            io.to(currentRoom).emit('opponentDisconnected', '対戦相手が切断されました。');
            
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Online Server is running on port ${PORT}`);
});
