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

const rooms = {};

// 挟んでひっくり返せるコマの座標リストを取得する関数
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

// その色のプレイヤーが「盤面のどこかに1箇所でも置ける場所があるか」を調べる関数
function hasValidMoves(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 0) {
                const flipped = getFlippedPieces(board, r, c, color);
                if (flipped.length > 0) return true;
            }
        }
    }
    return false;
}

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('joinRoom', (data) => {
        const { roomName, userName } = data;
        currentRoom = roomName;
        socket.join(roomName);

        if (!rooms[roomName]) {
            rooms[roomName] = {
                players: [],
                board: Array(8).fill(null).map(() => Array(8).fill(0)),
                currentPlayer: 2, // 先手: 白猫(2)
                gameFinished: false
            };
            rooms[roomName].board[3][3] = 2;
            rooms[roomName].board[3][4] = 1;
            rooms[roomName].board[4][3] = 1;
            rooms[roomName].board[4][4] = 2;
        }

        const room = rooms[roomName];
        room.players.push({ id: socket.id, name: userName });
        const playerIndex = room.players.length;

        if (playerIndex === 1) {
            socket.emit('assignColor', 2); // 白猫
            socket.emit('waiting', '対戦相手を待っています...🐾🐾');
        } else if (playerIndex === 2) {
            socket.emit('assignColor', 1); // 黒猫

            const player1 = room.players[0];
            const player2 = room.players[1];

            io.to(player1.id).emit('start', { opponentName: player2.name, board: room.board, currentPlayer: room.currentPlayer });
            io.to(player2.id).emit('start', { opponentName: player1.name, board: room.board, currentPlayer: room.currentPlayer });
        } else {
            socket.emit('full', 'この部屋は満員です。');
            socket.leave(roomName);
        }
    });

    socket.on('makeMove', (data) => {
        const room = rooms[currentRoom];
        if (!room || room.gameFinished) return;

        const { row, col, color } = data;

        if (room.currentPlayer !== color) return;

        const flipped = getFlippedPieces(room.board, row, col, color);
        if (flipped.length === 0) return;

        // 盤面更新
        room.board[row][col] = color;
        for (const [fr, fc] of flipped) {
            room.board[fr][fc] = color;
        }

        // 次の手番を決定するロジック（パス判定）
        const nextColor = room.currentPlayer === 2 ? 1 : 2;
        
        if (hasValidMoves(room.board, nextColor)) {
            // 通常通り相手の番
            room.currentPlayer = nextColor;
            io.to(currentRoom).emit('updateGameState', {
                board: room.board,
                currentPlayer: room.currentPlayer,
                passMessage: null
            });
        } else if (hasValidMoves(room.board, room.currentPlayer)) {
            // 相手が打てないので、自分が連続で打つ（パス発生）
            const passTargetName = nextColor === 2 ? "白猫" : "黒猫";
            io.to(currentRoom).emit('updateGameState', {
                board: room.board,
                currentPlayer: room.currentPlayer,
                passMessage: `${passTargetName} は置ける場所がないためパスします🐾`
            });
        } else {
            // 2人とも置けない、または盤面が埋まったのでゲーム終了
            room.gameFinished = true;
            
            let whiteCount = room.board.flat().filter(v => v === 2).length;
            let blackCount = room.board.flat().filter(v => v === 1).length;
            let winnerMessage = "";

            if (whiteCount > blackCount) {
                const winnerName = room.players[0] ? room.players[0].name : "白猫";
                winnerMessage = `🏆 白猫の ${winnerName} の勝ち！🏅`;
            } else if (blackCount > whiteCount) {
                const winnerName = room.players[1] ? room.players[1].name : "黒猫";
                winnerMessage = `🏆 黒猫の ${winnerName} の勝ち！🏅`;
            } else {
                winnerMessage = "引き分けです！ 🐾🐈🐾";
            }

            io.to(currentRoom).emit('gameOver', {
                board: room.board,
                winnerMessage: winnerMessage
            });
        }
    });

    // 誰かが切断されたら、部屋データを完全に削除して次回の入室エラーを防ぐ
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== socket.id);
            io.to(currentRoom).emit('opponentDisconnected', '対戦相手が切断されました。');
            
            // 部屋を完全にリセット・削除
            delete rooms[currentRoom];
        }
    });
});

http.listen(PORT, () => {
    console.log(`Online Server is running on port ${PORT}`);
});
