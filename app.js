const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = 3001;

app.use(express.static(__dirname));

app.get('/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ルームごとのゲーム状態を管理するオブジェクト
const rooms = {};

// リバーシの挟んでひっくり返すロジック（サーバー側で一括管理）
function getFlippedPieces(board, row, col, color) {
    if (board[row][col] !== 0) return [];
    
    const opponent = color === 1 ? 2 : 1;
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    let piecesToFlip = [];

    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        let temp = [];

        while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent) {
            temp.push([r, c]);
            r += dr;
            c += dc;
        }

        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color) {
            piecesToFlip = piecesToFlip.concat(temp);
        }
    }
    return piecesToFlip;
}

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('joinRoom', (data) => {
        const { roomName, userName } = data;
        currentRoom = roomName;
        socket.join(roomName);

        if (!rooms[roomName]) {
            // 新規ルームの初期化（盤面、プレイヤーリスト、手番の管理）
            rooms[roomName] = {
                players: [],
                board: Array(8).fill(null).map(() => Array(8).fill(0)),
                currentPlayer: 2 // 先手: 白猫(2)
            };
            // 初期4マスの配置
            rooms[roomName].board[3][3] = 2;
            rooms[roomName].board[3][4] = 1;
            rooms[roomName].board[4][3] = 1;
            rooms[roomName].board[4][4] = 2;
        }

        const room = rooms[roomName];
        room.players.push({ id: socket.id, name: userName });
        const playerIndex = room.players.length;

        if (playerIndex === 1) {
            socket.emit('assignColor', 2); // 1人目: 白猫
            socket.emit('waiting', '対戦相手を待っています...🐾🐾');
        } else if (playerIndex === 2) {
            socket.emit('assignColor', 1); // 2人目: 黒猫

            const player1 = room.players[0];
            const player2 = room.players[1];

            // ゲーム開始時、初期盤面とそれぞれの対戦相手名を送信
            io.to(player1.id).emit('start', { opponentName: player2.name, board: room.board, currentPlayer: room.currentPlayer });
            io.to(player2.id).emit('start', { opponentName: player1.name, board: room.board, currentPlayer: room.currentPlayer });
        } else {
            socket.emit('full', 'この部屋は満員です。');
            socket.leave(roomName);
        }
    });

    // コマが置かれたときの処理
    socket.on('makeMove', (data) => {
        const room = rooms[currentRoom];
        if (!room) return;

        const { row, col, color } = data;

        // 手番チェック
        if (room.currentPlayer !== color) return;

        // ひっくり返せるコマを取得
        const flipped = getFlippedPieces(room.board, row, col, color);
        
        // どこもひっくり返せない場所には置けないルール
        if (flipped.length === 0) return;

        // 盤面の更新
        room.board[row][col] = color;
        for (const [fr, fc] of flipped) {
            room.board[fr][fc] = color;
        }

        // 手番の交代
        room.currentPlayer = room.currentPlayer === 2 ? 1 : 2;

        // 参加者全員に「最新の盤面状態」と「次の手番」を一斉送信（同期ズレを完全に防止）
        io.to(currentRoom).emit('updateGameState', {
            board: room.board,
            currentPlayer: room.currentPlayer
        });
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== socket.id);
            io.to(currentRoom).emit('opponentDisconnected', '対戦相手が切断されました。');
            
            if (rooms[currentRoom].players.length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Online Server is running on port ${PORT}`);
});
