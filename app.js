const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const port = 3001;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let players = []; // 接続しているプレイヤーを保存

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 2人まで順番に色を割り振る
    if (players.length < 2) {
        // 1人目を白猫(2)、2人目を黒猫(1)にする（元のコードが白猫スタートのため）
        const myColor = players.length === 0 ? 2 : 1; 
        players.push(socket);
        socket.emit('assignColor', myColor);
        
        if (players.length === 2) {
            io.emit('start', '対戦をスタートします！白猫の番です。');
        } else {
            socket.emit('waiting', '対戦相手を待っています（1/2）...');
        }
    } else {
        socket.emit('full', '満員です。観戦モード、または時間を置いて接続してください。');
    }

    // 石が置かれた時の処理
    socket.on('makeMove', (data) => {
        // 全員に配置データをそのまま送って同期させる
        io.emit('updateBoard', data);
    });

    // プレイヤーの接続が切れたときの処理
    socket.on('disconnect', () => {
        console.log('ユーザーの接続が切れました');
        try {
            // サーバーがクラッシュしないように配列を空にする
            players = []; 
            
            // 全員に通知を送る（リロードを促すメッセージ）
            io.emit('gameStatus', { message: 'プレイヤーの接続が切れました。リロードして再開してください。' });
        } catch (error) {
            console.error('切断処理エラー:', error);
        }
    });
}); // ←ここが足りなかった閉じカッコだよ！

http.listen(port, () => {
    console.log(`Online Server is running on port ${port}`);
});
