const socket = io();
const statusElement = document.getElementById('status');
const boardElement = document.getElementById('board');
const lobbyElement = document.getElementById('lobby');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const usernameInput = document.getElementById('username');

let myColor = null;
let myName = "";
let opponentName = "対戦相手";
let gameStarted = false;
let board = [];
let currentPlayer = 2; 

const BLACK_CAT = 1;
const WHITE_CAT = 2;

const roomName = window.location.pathname.split('/')[1];

startBtn.addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        alert('名前を入力してね！');
        return;
    }

    lobbyElement.style.display = 'none';
    gameContainer.style.display = 'block';

    if (roomName) {
        socket.emit('joinRoom', { roomName, userName: myName });
    } else {
        const newRoom = Math.random().toString(36).substring(2, 7);
        window.history.pushState({}, '', `/${newRoom}`);
        socket.emit('joinRoom', { roomName: newRoom, userName: myName });
    }
});

socket.on('assignColor', (color) => {
    myColor = color;
});

socket.on('waiting', (msg) => {
    statusElement.innerText = msg;
});

socket.on('start', (data) => {
    gameStarted = true;
    opponentName = data.opponentName;
    board = data.board;
    currentPlayer = data.currentPlayer;
    
    lobbyElement.style.display = 'none';
    gameContainer.style.display = 'block';
    
    drawBoard();
    updateStatus();
});

function updateStatus(customTurnText = null) {
    if (!gameStarted) return;

    const myColorText = myColor === WHITE_CAT ? "白猫" : "黒猫";
    const myInfo = `【あなたは ${myColorText}の ${myName} です】`;

    let whiteCount = board.flat().filter(v => v === WHITE_CAT).length;
    let blackCount = board.flat().filter(v => v === BLACK_CAT).length;

    let turnText = "";
    if (customTurnText) {
        turnText = customTurnText;
    } else if (currentPlayer === myColor) {
        turnText = "あなたの番です 🐟🐈";
    } else {
        turnText = `${opponentName} の番です（相手の番）`;
    }

    statusElement.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${myInfo}</div>
        <div style="color: #008000; font-size: 16px; margin-bottom: 5px;">${turnText}</div>
        <div style="font-size: 14px; color: #333;">白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚</div>
    `;
}

function handleCellClick(row, col) {
    if (!gameStarted || currentPlayer !== myColor) return;
    if (board[row][col] !== 0) return;

    socket.emit('makeMove', { row, col, color: myColor });
}

// 通常の盤面更新（パス通知の処理を追加）
socket.on('updateGameState', (data) => {
    board = data.board;
    currentPlayer = data.currentPlayer;
    drawBoard();
    updateStatus();

    // パスが発生した場合は画面にアラートを出す
    if (data.passMessage) {
        setTimeout(() => { alert(data.passMessage); }, 100);
    }
});

// ゲーム終了の通知受信
socket.on('gameOver', (data) => {
    board = data.board;
    drawBoard();
    // ステータス画面のテキストを勝敗結果に書き換える
    updateStatus(`<span style="color: #ff0000; font-size: 20px;">${data.winnerMessage}</span>`);
    setTimeout(() => { alert(`ゲーム終了！\n${data.winnerMessage}`); }, 200);
});

// 相手が切断したときの処理
socket.on('opponentDisconnected', (msg) => {
    alert(msg);
    location.reload(); // 画面をリロードしてロビーに戻す
});

function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) { // ここを正しく c++ に直したよ！
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.addEventListener('click', () => handleCellClick(r, c));
            
            if (board[r][c] === BLACK_CAT) {
                const piece = document.createElement('div');
                piece.className = 'piece black'; 
                cell.appendChild(piece);
            } else if (board[r][c] === WHITE_CAT) {
                const piece = document.createElement('div');
                piece.className = 'piece white'; 
                cell.appendChild(piece);
            }
            
            boardElement.appendChild(cell);
        }
    }
}
