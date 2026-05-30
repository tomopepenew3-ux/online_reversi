// 画面の要素をキープ
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');

// サーバーに接続
const socket = io();

// URLの後ろから部屋名（ランダム文字列など）を取得
let roomName = window.location.pathname.split('/')[1];

// HTMLにあるロビーの要素（あとでindex.htmlに足すよ）
const lobby = document.getElementById('lobby');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username');
const startBtn = document.getElementById('start-btn');

// もしすでにURLに部屋名が入っている（直リンクで来た）なら、ロビーを飛ばしてゲーム画面へ
if (roomName) {
    if (lobby) lobby.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'block';
    
    // サーバーに「この部屋に入ります」と伝える
    socket.emit('joinRoom', roomName);
}

// 最初の画面で「START！」ボタンを押したときの処理
if (startBtn) {
    startBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) {
            alert('名前を入れてね！');
            return;
        }

        // URLに部屋名がない場合は、ランダムな5文字の部屋名を作る（例: ax39z）
        if (!roomName) {
            roomName = Math.random().toString(36).substring(2, 7);
            // ブラウザのURLを書き換える（ページはリロードされない）
            window.history.pushState({}, '', `/${roomName}`);
        }

        if (lobby) lobby.style.display = 'none';
        if (gameContainer) gameContainer.style.display = 'block';

        // サーバーに部屋への参加を伝える
        socket.emit('joinRoom', roomName);
    });
}

let myColor = null; // サーバーから割り当てられる自分の色
let gameStarted = false;

// 1: 黒猫, 2: 白猫, 0: 空白
const BLACK_CAT = 1;
const WHITE_CAT = 2;
let currentPlayer = WHITE_CAT; // 白猫からスタート

// 8x8の盤面データ（0で初期化）
let board = Array(8).fill(null).map(() => Array(8).fill(0));

// リバーシの初期配置
board[3][3] = WHITE_CAT;
board[3][4] = BLACK_CAT;
board[4][3] = BLACK_CAT;
board[4][4] = WHITE_CAT;

// 挟める方向の全 8 方向
const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
];

// 盤面を画面に描画する関数
function drawBoard() {
    boardElement.innerHTML = '';
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.addEventListener('click', () => handleCellClick(r, c));
            
            if (board[r][c] === BLACK_CAT) {
                const piece = document.createElement('div');
                piece.classList.add('piece', 'black');
                cell.appendChild(piece);
            } else if (board[r][c] === WHITE_CAT) {
                const piece = document.createElement('div');
                piece.classList.add('piece', 'white');
                cell.appendChild(piece);
            }
            
            boardElement.appendChild(cell);
        }
    }
    updateStatus();
}

// 状態表示のテキストを更新する関数
function updateStatus() {
    if (!gameStarted) return; // ゲーム開始前はサーバーの待機メッセージを優先

    const blackCount = board.flat().filter(p => p === BLACK_CAT).length;
    const whiteCount = board.flat().filter(p => p === WHITE_CAT).length;
    
    // 自分がどちらの猫かを表示
    const identityText = myColor === WHITE_CAT ? "【あなたは白猫です】" : "【あなたは黒猫です】";

    if (hasValidMoves(currentPlayer)) {
        const playerText = currentPlayer === WHITE_CAT ? "白猫クッキー" : "黒猫クッキー";
        const turnText = currentPlayer === myColor ? "あなたの番です！" : "相手の番です。";
        statusElement.innerHTML = `${identityText}<br>${playerText}の番：${turnText}<br>白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚`;
    } else {
        const nextPlayer = currentPlayer === WHITE_CAT ? BLACK_CAT : WHITE_CAT;
        if (hasValidMoves(nextPlayer)) {
            const passerText = currentPlayer === WHITE_CAT ? "白猫" : "黒猫";
            statusElement.innerHTML = `${identityText}<br>${passerText}は置けないのでパスします！`;
            currentPlayer = nextPlayer;
            setTimeout(updateStatus, 1500);
        } else {
            if (whiteCount > blackCount) {
                statusElement.innerHTML = `${identityText}<br>ゲーム終了！ 白猫の勝ち！<br>白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚`;
            } else if (blackCount > whiteCount) {
                statusElement.innerHTML = `${identityText}<br>ゲーム終了！ 黒猫の勝ち！<br>白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚`;
            } else {
                statusElement.innerHTML = `${identityText}<br>ゲーム終了！ 引き分けです！<br>白猫: ${whiteCount}枚 | 黒猫: ${blackCount}枚`;
            }
        }
    }
}

function getFlippablePieces(row, col, player, checkOnly = false) {
    if (board[row][col] !== 0) return [];
    const opponent = player === WHITE_CAT ? BLACK_CAT : WHITE_CAT;
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
        
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
            if (checkOnly && temp.length > 0) return true;
            piecesToFlip = piecesToFlip.concat(temp);
        }
    }
    return checkOnly ? false : piecesToFlip;
}

function hasValidMoves(player) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (getFlippablePieces(r, c, player, true)) return true;
        }
    }
    return false;
}

function handleCellClick(row, col) {
    // まだ開始していない、または自分の番ではないならクリックを無視
    if (!gameStarted || currentPlayer !== myColor) return;

    const piecesToFlip = getFlippablePieces(row, col, currentPlayer);
    if (piecesToFlip.length === 0) return;
    
    // 自分で直接書き換えずに、サーバーへ置いた位置を送信する
    socket.emit('makeMove', { row, col });
}

// --- 通信の受け取り処理 ---

// サーバーから自分の色を教えてもらったとき
socket.on('assignColor', (color) => {
    myColor = color;
});

// 相手を待っている間
socket.on('waiting', (msg) => {
    statusElement.innerText = msg;
});

// 2人揃ってゲームが始まったとき
socket.on('start', (msg) => {
    gameStarted = true;
    drawBoard();
});

// どちらかが石を置いたデータを同期するとき
socket.on('updateBoard', (data) => {
    const { row, col } = data;
    const piecesToFlip = getFlippablePieces(row, col, currentPlayer);
    
    board[row][col] = currentPlayer;
    for (const [r, c] of piecesToFlip) {
        board[r][c] = currentPlayer;
    }
    
    // ターンを交代して再描画
    currentPlayer = currentPlayer === WHITE_CAT ? BLACK_CAT : WHITE_CAT;
    drawBoard();
});

// 満員エラー時
socket.on('full', (msg) => {
    statusElement.innerText = msg;
});

// 相手が途中で切断したとき
socket.on('opponentDisconnected', (msg) => {
    gameStarted = false;
    statusElement.innerText = msg;
});

// 最初の初期描画（接続待ち状態）
updateStatus();
