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
let currentPlayer = 2; // 先手: 白猫(2)

const BLACK_CAT = 1;
const WHITE_CAT = 2;

// パスからルーム名（ID）を取得
const roomName = window.location.pathname.split('/')[1];

if (roomName) {
    // ルームID付きURLでアクセスされた場合も初期状態はロビーを表示
    lobbyElement.style.display = 'block';
    gameContainer.style.display = 'none';
}

// 開始ボタンのクリックイベント
startBtn.addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        alert('名前を入力してね！');
        return;
    }

    lobbyElement.style.display = 'none';
    gameContainer.style.display = 'block';

    if (roomName) {
        // 後攻プレイヤー：既存のルームへ参加要求
        socket.emit('joinRoom', { roomName, userName: myName });
    } else {
        // 先手プレイヤー：新規ルームを生成
        const newRoom = Math.random().toString(36).substring(2, 7);
        window.history.pushState({}, '', `/${newRoom}`);
        socket.emit('joinRoom', { roomName: newRoom, userName: myName });
    }
});

// プレイヤーカラーの割り当て
socket.on('assignColor', (color) => {
    myColor = color;
    updateStatus();
});

// 待機状態の通知受信
socket.on('waiting', (msg) => {
    statusElement.innerText = msg;
});

// ゲーム開始の通知受信（初期盤面の生成）
socket.on('start', (data) => {
    gameStarted = true;
    opponentName = data.opponentName;
    
    // 盤面配列の初期化（8x8、中央に初期配置）
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = WHITE_CAT;
    board[3][4] = BLACK_CAT;
    board[4][3] = BLACK_CAT;
    board[4][4] = WHITE_CAT;
    currentPlayer = WHITE_CAT;
    
    drawBoard();
    updateStatus();
});

// ステータス表示の更新
function updateStatus() {
    if (!gameStarted) return;

    const myColorText = myColor === WHITE_CAT ? "白猫" : "黒猫";
    const myInfo = `【あなたは ${myColorText}の ${myName} です】`;

    // 各色の手駒数を算出
    let whiteCount = board.flat().filter(v => v === WHITE_CAT).length;
    let blackCount = board.flat().filter(v => v === BLACK_CAT).length;

    // 手番メッセージの設定
    let turnText = "";
    if (currentPlayer === myColor) {
        turnText = "あなたの番です！🐟.....🐈";
    } else {
        turnText = `${opponentName} の番です（相手の番）`;
    }

    statusElement.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${myInfo}</div>
        <div style="color: #008000; font-size: 16px; margin-bottom: 5px;">${turnText}</div>
        <div style="font-size: 14px; color: #333;">白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚</div>
    `;
}

// セルクリック時のイベントハンドラ
function handleCellClick(row, col) {
    if (!gameStarted || currentPlayer !== myColor) return;
    if (board[row][col] !== 0) return;

    // 着手情報をサーバーへ送信
    socket.emit('makeMove', { row, col, color: myColor });
}

// 盤面更新データの受信処理
socket.on('updateBoard', (data) => {
    const { row, col, color } = data;
    board[row][col] = color;
    // ターン交代
    currentPlayer = currentPlayer === WHITE_CAT ? BLACK_CAT : WHITE_CAT;
    drawBoard();
    updateStatus();
});

// 盤面HTML要素のレンダリング
function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.addEventListener('click', () => handleCellClick(r, c));
            
            // クラス名に基づいた駒要素の配置
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
