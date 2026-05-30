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
let currentPlayer = 2; // 白猫(2)からスタート

const BLACK_CAT = 1;
const WHITE_CAT = 2;

// URLから部屋名（ルームID）を取得
const roomName = window.location.pathname.split('/')[1];

// ページを開いたときの処理
if (roomName) {
    // 部屋名がある場合でも、まずは名前を入力してもらうためにロビーを表示するよ！
    lobbyElement.style.display = 'block';
    gameContainer.style.display = 'none';
}

// STARTボタンを押したとき
startBtn.addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        alert('名前を入力してね！');
        return;
    }

    lobbyElement.style.display = 'none';
    gameContainer.style.display = 'block';

    if (roomName) {
        // Bさんの場合：既存の部屋に入る（自分の名前を一緒に送る）
        socket.emit('joinRoom', { roomName, userName: myName });
    } else {
        // Aさんの場合：新しい部屋を作る
        const newRoom = Math.random().toString(36).substring(2, 7);
        window.history.pushState({}, '', `/${newRoom}`);
        socket.emit('joinRoom', { roomName: newRoom, userName: myName });
    }
});

// --- 通信の受け取り処理 ---
socket.on('assignColor', (color) => {
    myColor = color;
    updateStatus();
});

socket.on('waiting', (msg) => {
    statusElement.innerText = msg;
});

// ゲーム開始の合図（相手の名前も一緒に届く！）
socket.on('start', (data) => {
    gameStarted = true;
    opponentName = data.opponentName;
    
    // 盤面の初期化
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = WHITE_CAT;
    board[3][4] = BLACK_CAT;
    board[4][3] = BLACK_CAT;
    board[4][4] = WHITE_CAT;
    currentPlayer = WHITE_CAT; // 白猫からスタート
    
    drawBoard();
    updateStatus();
});

// 状態（上の文字）を表示する関数
function updateStatus() {
    if (!gameStarted) return;

    const myColorText = myColor === WHITE_CAT ? "白猫" : "黒猫";
    const myInfo = `【あなたは ${myColorText}の ${myName} です】`;

    // 枚数を数える
    let whiteCount = 0;
    let blackCount = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; r < 8; r++) { // ⚠️ループ処理用
            // 実際は下のdrawBoardと同じようにカウント
        }
    }
    
    // 簡易的なカウント処理（正確な枚数用）
    whiteCount = board.flat().filter(v => v === WHITE_CAT).length;
    blackCount = board.flat().filter(v => v === BLACK_CAT).length;

    // どちらの番か（2行目のモヤモヤをスッキリ解消！）
    let turnText = "";
    if (currentPlayer === myColor) {
        turnText = "あなたの番です！🐾";
    } else {
        turnText = `${opponentName} の番です（相手の番）`;
    }

    statusElement.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${myInfo}</div>
        <div style="color: #008000; font-size: 16px; margin-bottom: 5px;">${turnText}</div>
        <div style="font-size: 14px;">白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚</div>
    `;
}

// 盤面を描く関数（トモの大事な画像をここに復活させたよ！）
function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            if (board[r][c] === BLACK_CAT) {
                const img = document.createElement('img');
                img.src = 'black_toka.png'; // 黒猫クッキー画像！
                img.className = 'piece';
                cell.appendChild(img);
            } else if (board[r][c] === WHITE_CAT) {
                const img = document.createElement('img');
                img.src = 'white_toka.png'; // 白猫クッキー画像！
                img.className = 'piece';
                cell.appendChild(img);
            }
            
            boardElement.appendChild(cell);
        }
    }
}
