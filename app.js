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

// 各部屋のプレイヤーを管理するオブジェクト
const rooms = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    // 部屋に入る合図を受け取ったとき
    socket.on('joinRoom', (roomName) => {
        currentRoom = roomName;
        socket.join(roomName);

        // まだ部屋が存在しなかったら新しく作る
        if (!rooms[roomName]) {
            rooms[roomName] = [];
        }

        // 部屋にプレイヤーを登録
        rooms[roomName].push(socket.id);
        const playerIndex = rooms[roomName].length;

        if (playerIndex === 1) {
            // 1人目は白猫（2）
            socket.emit('assignColor', 2); 
            socket.emit('waiting', '対戦相手を待っています...');
        } else if (playerIndex === 2) {
            // 2人目は黒猫（1）
            socket.emit('assignColor', 1);
            // 部屋にいる全員に「ゲーム開始！」の合図を送る
            io.to(roomName).emit('start', 'ゲーム開始！');
        } else {
            // 3人目以降は満員エラー
            socket.emit('full', 'この部屋は満員です。');
            socket.leave(roomName);
        }
    });

    // コマが置かれたときの合図
    socket.on('makeMove', (data) => {
        if (currentRoom) {
            // 部屋の全員に置かれた位置を伝える
            io.to(currentRoom).emit('updateBoard', data);
        }
    });

    // 接続が切れたとき
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            // 抜けた人をリストから削除
            rooms[currentRoom] = rooms[currentRoom].filter(id => id !== socket.id);
            // 残された相手に通知
            io.to(currentRoom).emit('opponentDisconnected', '対戦相手が切断されました。');
            
            // 部屋が空っぽになったら消す
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Online Server is running on port ${PORT}`);
});
