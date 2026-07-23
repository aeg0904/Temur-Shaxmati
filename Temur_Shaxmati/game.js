// ============================================================
//  AMIR TEMUR SHAXMATI — game.js  v5
//  10×11 + 2 citadel, barcha qoidalar
// ============================================================

// ── O'YIN HOLATI ─────────────────────────────────────────────
let gameState = {
  board:          null,
  currentTurn:    COLOR.WHITE,
  mode:           'ai',
  difficulty:     'easy',
  selected:       null,
  legalMoves:     [],
  history:        [],
  moveList:       [],
  capturedWhite:  [],
  capturedBlack:  [],
  status:         'normal',
  aiThinking:     false,
  gameOver:       false,
  // Citadel: null = bo'sh, COLOR.X = shu rang qirollik donasi ichida
  whiteCitadel:   null,
  blackCitadel:   null,
  // Shoh joy almashtirishi: har shoh uchun 1 marta
  kingSwapUsed:   { white: false, black: false },
  // Swap rejimi: tanlangan shoh + kutilayotgan swap
  swapMode:       false,
  pendingPromo:   null,  // { r, c, color, type }
};

// ── CANVAS ───────────────────────────────────────────────────
let canvas, ctx;
let CELL_W = 54;
let CELL_H = 54;
const CIT_W = 44;   // citadel katak kengligi
const CIT_GAP = 6;  // taxta bilan bo'shliq

const CLR = {
  light:    '#F0D9B5',
  dark:     '#B58863',
  selected: 'rgba(255,215,0,0.70)',
  legalDot: 'rgba(0,0,0,0.20)',
  legalCap: 'rgba(200,30,30,0.30)',
  lastMove: 'rgba(255,215,0,0.28)',
  check:    'rgba(220,38,38,0.48)',
  hover:    'rgba(255,255,255,0.09)',
  citadel:  { white:'rgba(240,217,181,0.18)', black:'rgba(100,60,20,0.28)' },
  citBorder:'#C9A84C',
};

// ── RESIZE ───────────────────────────────────────────────────
function resizeCanvas() {
  if (!canvas) return;
  const maxBoard = Math.min(window.innerWidth - 120, 594); // 11*54
  CELL_W = Math.floor(maxBoard / BOARD_COLS);
  CELL_H = CELL_W;
  // Canvas: taxta + 2 citadel + bo'shliqlar
  canvas.width  = CELL_W * BOARD_COLS + (CIT_W + CIT_GAP) * 2;
  canvas.height = CELL_H * BOARD_ROWS;
}

// Taxta x-boshi (citadel uchun o'ng siljish)
function bx() { return CIT_W + CIT_GAP; }

// ── BOSHLASH ─────────────────────────────────────────────────
function initGame() {
  canvas = document.getElementById('game-board');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); drawBoard(); });
  canvas.addEventListener('click',      onBoardClick);
  canvas.addEventListener('mousemove',  onBoardHover);
  canvas.addEventListener('mouseleave', () => { hoverCell = null; drawBoard(); });
  document.addEventListener('langChanged', () => { updateAllI18n(); if (gameState.board) drawBoard(); });
  buildCoords();
  drawEmptyBoard();
}

let hoverCell = null;
let lastMove  = null;

// ── BO'SH TAXTA ───────────────────────────────────────────────
function drawEmptyBoard() {
  if (!ctx) return;
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(bx(), 0);
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? CLR.light : CLR.dark;
      ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W, CELL_H);
    }
  ctx.restore();
  drawCitadels();
}

// ── KOORDINATALAR ─────────────────────────────────────────────
function buildCoords() {
  const cols = 'abcdefghijk'.split('');
  ['board-coords-top','board-coords-bottom'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    // Citadel bo'shlig'i
    const spacer = document.createElement('div');
    spacer.style.width = (CIT_W + CIT_GAP) + 'px';
    el.appendChild(spacer);
    cols.forEach(c => {
      const d = document.createElement('div');
      d.className = 'coord-label';
      d.style.width = CELL_W + 'px';
      d.style.textAlign = 'center';
      d.textContent = c;
      el.appendChild(d);
    });
  });
  ['board-coords-left','board-coords-right'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    // BOARD_ROWS = 10, qatorlar: 10 (yuqori) → 1 (pastki)
    for (let r = 0; r < BOARD_ROWS; r++) {
      const d = document.createElement('div');
      d.className = 'coord-label';
      d.style.height = CELL_H + 'px';
      d.style.lineHeight = CELL_H + 'px';
      d.textContent = BOARD_ROWS - r;   // 10, 9, 8 ... 1
      el.appendChild(d);
    }
  });
}

// ── TAXTA CHIZISH ─────────────────────────────────────────────
function drawBoard() {
  if (!ctx) return;
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(bx(), 0);
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++)
      drawCell(r, c);
  ctx.restore();
  drawCitadels();
}

function drawCell(r, c) {
  const x = c * CELL_W, y = r * CELL_H;
  ctx.fillStyle = (r + c) % 2 === 0 ? CLR.light : CLR.dark;
  ctx.fillRect(x, y, CELL_W, CELL_H);

  if (lastMove) {
    const { fr, fc, tr, tc } = lastMove;
    if ((r===fr&&c===fc)||(r===tr&&c===tc)) {
      ctx.fillStyle = CLR.lastMove;
      ctx.fillRect(x, y, CELL_W, CELL_H);
    }
  }
  if (gameState.selected?.row===r && gameState.selected?.col===c) {
    ctx.fillStyle = CLR.selected;
    ctx.fillRect(x, y, CELL_W, CELL_H);
  }
  if (gameState.status==='check' && gameState.board) {
    const p = gameState.board[r][c];
    if (p && isRoyal(p.type) && p.color===gameState.currentTurn) {
      ctx.fillStyle = CLR.check;
      ctx.fillRect(x, y, CELL_W, CELL_H);
    }
  }
  const isLegal = gameState.legalMoves.some(([lr,lc])=>lr===r&&lc===c);
  if (isLegal) {
    const has = gameState.board?.[r]?.[c];
    if (has) {
      ctx.strokeStyle='rgba(180,30,30,0.85)';
      ctx.lineWidth=2.5;
      ctx.strokeRect(x+2,y+2,CELL_W-4,CELL_H-4);
    } else {
      ctx.fillStyle=CLR.legalDot;
      ctx.beginPath();
      ctx.arc(x+CELL_W/2,y+CELL_H/2,CELL_W*0.15,0,Math.PI*2);
      ctx.fill();
    }
  }
  if (hoverCell?.r===r && hoverCell?.c===c) {
    ctx.fillStyle=CLR.hover;
    ctx.fillRect(x,y,CELL_W,CELL_H);
  }
  if (gameState.board?.[r]?.[c]) drawPiece(gameState.board[r][c], x, y);
}

// ── DONA CHIZISH ──────────────────────────────────────────────
function drawPiece(piece, x, y) {
  ctx.save();
  const cx = x + CELL_W / 2;
  const cy = y + CELL_H / 2;
  const isW = piece.color === COLOR.WHITE;
  const disp = PIECE_DISPLAY[piece.type] || { sym:'?', symB:'?', short:'' };
  const radius = CELL_W * 0.40;

  // ── Soya ──
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(cx+1.5, cy+radius*0.5, radius*0.7, radius*0.16, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Tashqi halqa (oltin) ──
  ctx.fillStyle = isW ? '#7a5c10' : '#2a1000';
  ctx.beginPath();
  ctx.arc(cx, cy, radius+1.5, 0, Math.PI*2);
  ctx.fill();

  // ── Gradient fon ──
  const g = ctx.createRadialGradient(cx-radius*0.22, cy-radius*0.22, radius*0.05, cx, cy, radius);
  if (isW) {
    g.addColorStop(0,'#FFFFFF');
    g.addColorStop(0.6,'#EDE0C0');
    g.addColorStop(1,'#C8A84A');
  } else {
    g.addColorStop(0,'#5a3010');
    g.addColorStop(0.6,'#2A1200');
    g.addColorStop(1,'#100800');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.fill();

  // ── Qirollik donalari uchun toj belgisi ──
  if (isRoyal(piece.type)) {
    ctx.strokeStyle = isW ? 'rgba(201,168,76,0.7)' : 'rgba(201,168,76,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius*0.88, 0, Math.PI*2);
    ctx.stroke();
  }

  // ── Unicode belgisi ──
  const sym   = isW ? disp.sym : disp.symB;
  const short = disp.short || '';

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  if (short && !['', ' '].includes(short)) {
    // Pastda qisqa harf bor → belgini yuqoriroq chiz
    ctx.font      = `${CELL_W * 0.48}px serif`;
    ctx.fillStyle = isW ? '#1a0e00' : '#F5EDD6';
    ctx.fillText(sym, cx, cy - CELL_H*0.06);
    // Yorliq
    ctx.font      = `bold ${CELL_W * 0.20}px Inter,sans-serif`;
    ctx.fillStyle = isW ? '#8B6914' : '#C9A84C';
    ctx.fillText(short, cx, cy + CELL_H*0.23);
  } else {
    // Faqat unicode
    ctx.font      = `${CELL_W * 0.58}px serif`;
    ctx.fillStyle = isW ? '#1a0e00' : '#F5EDD6';
    ctx.fillText(sym, cx, cy+1);
  }

  // Prince/AdvKing uchun maxsus ko'rinish
  if (piece.type === PIECE.PRINCE) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius+3, 0, Math.PI*2);
    ctx.stroke();
  }
  if (piece.type === PIECE.ADV_KING) {
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([3,2]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius+4, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ── CITADEL CHIZISH ───────────────────────────────────────────
function drawCitadels() {
  if (!ctx) return;
  // White Citadel: chap tomonda, row=1 (a9 yonida)
  // x = 0 (citadel chap panelda), y = row * CELL_H
  drawOneCitadel(0, CITADEL.WHITE.r * CELL_H, COLOR.WHITE, gameState.whiteCitadel);
  // Black Citadel: o'ng tomonda, row=8 (k2 yonida)
  const rightX = bx() + BOARD_COLS * CELL_W + CIT_GAP;
  drawOneCitadel(rightX, CITADEL.BLACK.r * CELL_H, COLOR.BLACK, gameState.blackCitadel);
}

function drawOneCitadel(x, y, owner, occupant) {
  const w    = CIT_W;
  const h    = CELL_H;
  const isW  = owner === COLOR.WHITE;
  const wallClr = isW ? '#c8a96e' : '#7a4e2d';
  const shadClr = isW ? 'rgba(255,220,140,0.18)' : 'rgba(120,60,20,0.28)';
  const merlonH = h * 0.22;
  const wallY   = y + merlonH;
  const wallH   = h - merlonH;

  ctx.save();

  // 1. Devor asosi
  ctx.fillStyle = shadClr;
  ctx.fillRect(x, wallY, w, wallH);

  // 2. G'isht chiziqlar
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x, wallY + (wallH / 4) * i);
    ctx.lineTo(x + w, wallY + (wallH / 4) * i);
    ctx.globalAlpha = 0.22;
    ctx.stroke();
  }
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 3) * i, wallY);
    ctx.lineTo(x + (w / 3) * i, y + h);
    ctx.globalAlpha = 0.18;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 3. Merlon tishlari (3 ta)
  ctx.fillStyle = wallClr;
  const merlonW  = w * 0.28;
  const gap      = (w - merlonW * 3) / 4;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + gap + i * (merlonW + gap), y, merlonW, merlonH + 2);
  }

  // 4. Devor borderi
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(x + 0.5, wallY + 0.5, w - 1, wallH - 1);
  ctx.globalAlpha = 1;

  // 5. Eshik
  const doorW = w * 0.32;
  const doorH = wallH * 0.38;
  const doorX = x + (w - doorW) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(doorX, y + h);
  ctx.lineTo(doorX, y + h - doorH + doorH * 0.35);
  ctx.arc(doorX + doorW / 2, y + h - doorH + doorH * 0.35, doorW / 2, Math.PI, 0);
  ctx.lineTo(doorX + doorW, y + h);
  ctx.fill();

  // 6. Legal highlight
  const cit = isW ? CITADEL.WHITE : CITADEL.BLACK;
  if (gameState.legalMoves.some(([lr, lc]) => lr === cit.r && lc === cit.c)) {
    ctx.fillStyle = 'rgba(107,196,106,0.28)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(107,196,106,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  // 7. Ichidagi shoh belgisi
  if (occupant) {
    const ch = occupant.color === COLOR.WHITE ? '♔' : '♚';
    ctx.font = `bold ${w * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = occupant.color === COLOR.WHITE ? '#fff' : '#1a0a00';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(ch, x + w / 2, wallY + wallH * 0.5);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ── MOUSE ─────────────────────────────────────────────────────
function getCellFromEvent(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const rawX   = (e.clientX - rect.left) * scaleX;
  const rawY   = (e.clientY - rect.top)  * scaleY;
  const boardX = rawX - bx();
  const r = Math.floor(rawY  / CELL_H);
  const c = Math.floor(boardX / CELL_W);

  // Citadel zonalari (chap va o'ng panel)
  if (rawX >= 0 && rawX < bx() && r === CITADEL.WHITE.r)
    return { r: CITADEL.WHITE.r, c: CITADEL.WHITE.c };
  if (rawX > bx() + BOARD_COLS*CELL_W && r === CITADEL.BLACK.r)
    return { r: CITADEL.BLACK.r, c: CITADEL.BLACK.c };
  return { r, c };
}

function onBoardHover(e) {
  if (!gameState.board || gameState.gameOver) return;
  const { r, c } = getCellFromEvent(e);
  if (!inBounds(r,c) && !isCitadelCoord(r,c)) { hoverCell=null; drawBoard(); return; }
  if (hoverCell?.r!==r || hoverCell?.c!==c) {
    hoverCell = {r,c};
    drawBoard();
    showPieceInfoPopup(r,c);
  }
}

function onBoardClick(e) {
  if (!gameState.board || gameState.gameOver || gameState.aiThinking) return;
  if (gameState.mode==='ai' && gameState.currentTurn===COLOR.BLACK) return;
  if (gameState.mode==='online') {
    if (!OnlineGame.state.isGameActive) return;
    const myColor = OnlineGame.state.myColor === 'white' ? COLOR.WHITE : COLOR.BLACK;
    if (gameState.currentTurn !== myColor) return;
  }
  const {r,c} = getCellFromEvent(e);
  if (!inBounds(r,c) && !isCitadelCoord(r,c)) return;
  handleCellClick(r,c);
}

// ── CLICK HANDLER ─────────────────────────────────────────────
function handleCellClick(r, c) {
  const board = gameState.board;
  const piece = inBounds(r,c) ? board[r][c] : null;

  // Swap rejimida: shoh tanlangan + boshqa o'z donasi bosish
  if (gameState.swapMode && gameState.selected) {
    const selPiece = board[gameState.selected.row][gameState.selected.col];
    if (piece && piece.color===gameState.currentTurn &&
        !isRoyal(piece.type) && isPossibleSwapTarget(r,c)) {
      executeSwap(gameState.selected.row, gameState.selected.col, r, c);
      return;
    }
    // Swap bekor
    gameState.swapMode = false;
  }

  // Legal yurish
  if (gameState.selected &&
      gameState.legalMoves.some(([lr,lc])=>lr===r&&lc===c)) {
    applyMove(gameState.selected.row, gameState.selected.col, r, c);
    return;
  }

  // O'z donasini tanlash
  if (piece && piece.color===gameState.currentTurn) {
    gameState.selected   = {row:r, col:c};
    let moves = getLegalMoves(board, r, c, gameState);
    // Citadel band tekshiruvi
    moves = moves.filter(([mr,mc]) => {
      if (!isCitadelCoord(mr,mc)) return true;
      const cit = (mr===CITADEL.WHITE.r&&mc===CITADEL.WHITE.c)
                  ? gameState.whiteCitadel : gameState.blackCitadel;
      return cit === null;
    });
    gameState.legalMoves = moves;

    // Shoh tanlanganda swap tugmasini faqat xavf ostida bo'lsa ko'rsat
    const inDanger = gameState.status==='check' || gameState.status==='checkmate' || gameState.status==='stalemate_loss';
    if (isRoyal(piece.type) && !gameState.kingSwapUsed[piece.color] && inDanger) {
      showSwapHint(true);
    } else {
      showSwapHint(false);
    }
    drawBoard();
    return;
  }

  gameState.selected   = null;
  gameState.legalMoves = [];
  gameState.swapMode   = false;
  showSwapHint(false);
  drawBoard();
}

function isPossibleSwapTarget(r,c) {
  if (!gameState.selected) return false;
  const king = gameState.board[gameState.selected.row][gameState.selected.col];
  if (!king || !isRoyal(king.type)) return false;
  // Qoida: faqat shoh/shahzoda check, mat yoki pat holatida bo'lganda swap qilish mumkin
  const danger = gameState.status==='check' || gameState.status==='checkmate' || gameState.status==='stalemate_loss';
  if (!danger) return false;
  // Swap faqat qo'shni katak (Shoh yurish masofasi)
  const dr = Math.abs(r - gameState.selected.row);
  const dc = Math.abs(c - gameState.selected.col);
  return dr<=1 && dc<=1;
}

function executeSwap(kr, kc, tr, tc) {
  saveHistory();
  const board = gameState.board;
  const king  = board[kr][kc];
  const target= board[tr][tc];
  board[kr][kc] = {...target};
  board[tr][tc] = {...king, moved:true};
  gameState.kingSwapUsed[king.color] = true;
  lastMove = {fr:kr, fc:kc, tr, tc};
  gameState.selected   = null;
  gameState.legalMoves = [];
  gameState.swapMode   = false;
  showSwapHint(false);
  addMoveToList(king,kr,kc,tr,tc,null,'swap');
  finishMove();
}

function showSwapHint(show) {
  const el = document.getElementById('swap-hint');
  if (el) el.classList.toggle('hidden', !show);
}

// ── YURISH ────────────────────────────────────────────────────
function saveHistory() {
  gameState.history.push({
    board:          cloneBoard(gameState.board),
    turn:           gameState.currentTurn,
    lastMove:       lastMove ? {...lastMove} : null,
    status:         gameState.status,
    capturedWhite:  [...gameState.capturedWhite],
    capturedBlack:  [...gameState.capturedBlack],
    moveListLen:    gameState.moveList.length,
    whiteCitadel:   gameState.whiteCitadel,
    blackCitadel:   gameState.blackCitadel,
    kingSwapUsed:   {...gameState.kingSwapUsed},
  });
}

function applyMove(fr, fc, tr, tc) {
  const board    = gameState.board;
  const piece    = board[fr][fc];
  const captured = isCitadelCoord(tr,tc) ? null : board[tr][tc];

  saveHistory();

  if (captured) {
    if (captured.color===COLOR.WHITE) gameState.capturedWhite.push(captured.type);
    else                              gameState.capturedBlack.push(captured.type);
    updateCaptured();
  }

  // ── Citadelga kirish ──────────────────────────────────────
  if (isCitadelCoord(tr,tc)) {
    const citOwner = citadelOwnerColor(tr,tc);
    board[fr][fc] = null;
    lastMove = {fr, fc, tr, tc, toCitadel:true};
    addMoveToList(piece,fr,fc,tr,tc,null,'citadel');

    if (citOwner === piece.color) {
      // O'z citadeli — davom
      if (piece.color===COLOR.WHITE) gameState.whiteCitadel = piece;
      else                           gameState.blackCitadel = piece;
      gameState.selected   = null;
      gameState.legalMoves = [];
      drawBoard();
      finishMove();
    } else {
      // Raqib citadeli → DURANG
      if (piece.color===COLOR.WHITE) gameState.blackCitadel = piece;
      else                           gameState.whiteCitadel = piece;
      gameState.gameOver = true;
      gameState.status   = 'citadel_draw';
      drawBoard();
      if (gameState.mode==='online') {
        gameState.currentTurn = opponent(gameState.currentTurn);
        window.onlineOnLocalMoveApplied?.(lastMove);
      } else {
        setTimeout(() => showEndModal('citadel_draw', piece.color), 500);
      }
    }
    return;
  }

  // Citadeldan chiqish
  if (isRoyal(piece.type)) {
    if (piece.color===COLOR.WHITE && fr===CITADEL.WHITE.r && fc===CITADEL.WHITE.c) {
      gameState.whiteCitadel = null;
    }
    if (piece.color===COLOR.BLACK && fr===CITADEL.BLACK.r && fc===CITADEL.BLACK.c) {
      gameState.blackCitadel = null;
    }
  }

  board[tr][tc] = {...piece, moved:true};
  board[fr][fc] = null;
  lastMove = {fr, fc, tr, tc};
  addMoveToList(piece,fr,fc,tr,tc,captured);

  // Piyoda promotion
  if (shouldPromote(piece, tr)) {
    const promoType = promotionLogic(piece);
    gameState.pendingPromo = {r:tr, c:tc, color:piece.color, basePawnType:piece.type,
                               oldCount: piece.promoteCount||0};
    gameState.selected   = null;
    gameState.legalMoves = [];
    drawBoard();
    showPromotionModal(promoType, piece);
    return;
  }

  gameState.selected   = null;
  gameState.legalMoves = [];
  finishMove();
}

function finishMove() {
  gameState.currentTurn = opponent(gameState.currentTurn);
  const state = getGameState(gameState.board, gameState.currentTurn, gameState);
  gameState.status = state;
  drawBoard();
  updateStatus(state);

  if (state==='checkmate'||state==='stalemate_loss'||state==='no_royals') {
    gameState.gameOver = true;
    if (gameState.mode==='online') {
      window.onlineOnLocalMoveApplied?.(lastMove);
    } else {
      setTimeout(()=>showEndModal(state, null), 700);
    }
    return;
  }
  if (gameState.mode==='online') {
    window.onlineOnLocalMoveApplied?.(lastMove);
    return;
  }
  if (gameState.mode==='ai' && gameState.currentTurn===COLOR.BLACK && !gameState.gameOver)
    triggerAI();
}

// ── PROMOTION ────────────────────────────────────────────────
function showPromotionModal(suggestedType, piece) {
  // Tanlov modali kerak emas — har bir piyoda faqat o'z turidagi
  // donaga aylanadi (pawnKing/pawnPawn bundan mustasno, alohida boshqariladi).
  const { r, c, color } = gameState.pendingPromo;
  const newPiece = {
    color, type: suggestedType, moved: true,
    promoteCount: (gameState.pendingPromo.oldCount || 0) + 1
  };
  gameState.board[r][c] = newPiece;
  gameState.pendingPromo = null;
  finishMove();
}

// getPromotionChoices() endi kerak emas — olib tashlanadi

// ── AI ────────────────────────────────────────────────────────
function triggerAI() {
  gameState.aiThinking = true;
  document.getElementById('ai-thinking')?.classList.remove('hidden');
  aiMoveAsync(gameState.board, COLOR.BLACK, gameState.difficulty, (move)=>{
    gameState.aiThinking=false;
    document.getElementById('ai-thinking')?.classList.add('hidden');
    if (!move||gameState.gameOver) return;
    applyMove(move.fr, move.fc, move.tr, move.tc);
  });
}

// ── UNDO ─────────────────────────────────────────────────────
function undoMove() {
  if (gameState.history.length===0||gameState.aiThinking) return;
  let steps = gameState.mode==='ai' ? 2 : 1;
  steps = Math.min(steps, gameState.history.length);
  for (let i=0;i<steps;i++) {
    const prev = gameState.history.pop();
    if (!prev) continue;
    gameState.board         = prev.board;
    gameState.currentTurn   = prev.turn;
    gameState.status        = prev.status;
    gameState.capturedWhite = prev.capturedWhite;
    gameState.capturedBlack = prev.capturedBlack;
    lastMove                = prev.lastMove;
    gameState.moveList.splice(prev.moveListLen);
    gameState.whiteCitadel  = prev.whiteCitadel;
    gameState.blackCitadel  = prev.blackCitadel;
    gameState.kingSwapUsed  = prev.kingSwapUsed;
  }
  gameState.selected=null; gameState.legalMoves=[];
  gameState.gameOver=false; gameState.swapMode=false;
  renderMoveList(); updateCaptured(); drawBoard(); updateStatus(gameState.status);
}

// ── STATUS ────────────────────────────────────────────────────
function updateStatus(state) {
  const el = document.getElementById('game-status');
  if (!el) return;
  el.className='game-status';
  const msgs = {
    checkmate:     ()=>{ el.classList.add('mate'); return t('game_checkmate')||'Mat!'; },
    stalemate_loss:()=>{ el.classList.add('mate'); return "Pat — Yutuq (raqibga)!"; },
    no_royals:     ()=>t('game_draw')||'Barcha qirolliklar yo\'qoldi!',
    citadel_draw:  ()=>"🏰 Qal'a — Durang!",
    check:         ()=>{ el.classList.add('check'); return t('game_check')||'Shoh!'; },
    normal:        ()=> gameState.mode==='ai'
      ? (gameState.currentTurn===COLOR.WHITE ? t('game_your_turn') : t('game_ai_turn'))
      : (gameState.currentTurn===COLOR.WHITE?'⬜ ':'⬛ ')+(t('game_your_turn')||'Navbat'),
  };
  el.textContent = (msgs[state]||msgs.normal)();
}

// ── YURISH TARIXI ─────────────────────────────────────────────
function addMoveToList(piece, fr, fc, tr, tc, captured, special) {
  const cols='abcdefghijk';
  const from=inBounds(fr,fc) ? cols[fc]+(BOARD_ROWS-fr) : 'Cit';
  const to  =isCitadelCoord(tr,tc) ? '🏰' : cols[tc]+(BOARD_ROWS-tr);
  // BOARD_ROWS=10: row 0 → qator 10, row 9 → qator 1
  const disp=PIECE_DISPLAY[piece.type];
  gameState.moveList.push({
    sym:  piece.color===COLOR.WHITE?disp.sym:disp.symB,
    from, to, cap:!!captured, special:special||null,
  });
  renderMoveList();
}

function renderMoveList() {
  const list=document.getElementById('moves-list');
  if (!list) return;
  list.innerHTML='';
  gameState.moveList.forEach((m,i)=>{
    const div=document.createElement('div');
    div.className='move-entry';
    const note = m.special==='citadel'?'🏰':m.special==='swap'?'↔':m.cap?'×':'-';
    div.innerHTML=`<span class="move-num">${i+1}.</span>
      <span>${m.sym} ${m.from}${note}${m.to}</span>`;
    list.appendChild(div);
  });
  list.scrollTop=list.scrollHeight;
}

// ── YUTILGAN DONALAR ──────────────────────────────────────────
function updateCaptured() {
  const wEl=document.getElementById('captured-white');
  const bEl=document.getElementById('captured-black');
  if (wEl) wEl.textContent=gameState.capturedWhite.map(tp=>(PIECE_DISPLAY[tp]?.sym)||'').join(' ');
  if (bEl) bEl.textContent=gameState.capturedBlack.map(tp=>(PIECE_DISPLAY[tp]?.symB)||'').join(' ');
}

// ── POPUP ─────────────────────────────────────────────────────
function showPieceInfoPopup(r,c) {
  const popup=document.getElementById('piece-info-popup');
  if (!popup) return;
  let piece=null;
  if (isCitadelCoord(r,c)) {
    const occupant=(r===CITADEL.WHITE.r&&c===CITADEL.WHITE.c)
      ?gameState.whiteCitadel:gameState.blackCitadel;
    piece=occupant;
    if (!piece) {
      const ow=(r===CITADEL.WHITE.r&&c===CITADEL.WHITE.c)?'OQ':'QORA';
      document.getElementById('pip-title').textContent=`${ow} Qal'asi`;
      document.getElementById('pip-desc').textContent="Faqat qirollik donalari kirishi mumkin. Raqib citadeliga kirish → Durang!";
      popup.classList.remove('hidden'); return;
    }
  } else {
    piece=gameState.board?.[r]?.[c];
  }
  if (!piece){popup.classList.add('hidden');return;}
  const info=getPieceInfo(piece.type, typeof currentLang!=='undefined'?currentLang:'uz');
  document.getElementById('pip-title').textContent=info.name;
  document.getElementById('pip-desc').textContent=info.desc;
  popup.classList.remove('hidden');
}

// ── O'YIN TUGASHI ─────────────────────────────────────────────
function showEndModal(state, moverColor) {
  const modal=document.getElementById('end-modal');
  const iconEl=document.getElementById('end-icon');
  const titleEl=document.getElementById('end-title');
  const subEl=document.getElementById('end-subtitle');
  if (!modal) return;

  if (state==='citadel_draw') {
    iconEl.textContent='🏰';
    titleEl.textContent=t('game_draw')||'Durang!';
    subEl.textContent=(moverColor===COLOR.WHITE?'Oq':'Qora')+" raqib Qal'asiga kirdi!";
  } else if (state==='checkmate') {
    const winner=opponent(gameState.currentTurn);
    iconEl.textContent='🏆';
    titleEl.textContent=winner===COLOR.WHITE?t('game_white_wins'):t('game_black_wins');
    subEl.textContent=t('game_checkmate')||'Mat!';
  } else if (state==='no_royals') {
    iconEl.textContent='👑';
    titleEl.textContent=gameState.currentTurn===COLOR.WHITE?t('game_black_wins'):t('game_white_wins');
    subEl.textContent="Barcha qirollik donalari yo'qoldi!";
  } else if (state==='stalemate_loss') {
    // Patga tushgan tomon yutqazadi
    const winner = opponent(gameState.currentTurn);
    iconEl.textContent='🏆';
    titleEl.textContent = winner===COLOR.WHITE ? t('game_white_wins') : t('game_black_wins');
    subEl.textContent = "Pat — qoidaga ko'ra yutqazish!";
  } else {
    iconEl.textContent='🤝';
    titleEl.textContent=t('game_draw')||'Durang!';
    subEl.textContent='Barcha qirolliklar yo\'qoldi';
  }
  modal.classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// ── QIYINLIK ─────────────────────────────────────────────────
function setDiff(event,diff) {
  event.stopPropagation();
  gameState.difficulty=diff;
  document.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('active',b.dataset.diff===diff));
}

// ── O'YIN BOSHLASH ────────────────────────────────────────────
function startGame(mode) {
  gameState.mode          = mode;
  gameState.board         = createInitialBoard();
  gameState.currentTurn   = COLOR.WHITE;
  gameState.selected      = null;
  gameState.legalMoves    = [];
  gameState.history       = [];
  gameState.moveList      = [];
  gameState.capturedWhite = [];
  gameState.capturedBlack = [];
  gameState.status        = 'normal';
  gameState.aiThinking    = false;
  gameState.gameOver      = false;
  gameState.whiteCitadel  = null;
  gameState.blackCitadel  = null;
  gameState.kingSwapUsed  = {white:false, black:false};
  gameState.swapMode      = false;
  gameState.pendingPromo  = null;
  lastMove = null;

  document.getElementById('mode-select')?.classList.add('hidden');
  document.getElementById('game-ui')?.classList.remove('hidden');

  const wl=document.getElementById('white-label');
  const bl=document.getElementById('black-label');
  if (wl) wl.textContent=mode==='ai'?'👤 Siz (Oq)':'⬜ Oqlar';
  if (bl) bl.textContent=mode==='ai'?'🤖 AI (Qora)':'⬛ Qoralar';

  canvas = document.getElementById('game-board');
  ctx    = canvas ? canvas.getContext('2d') : null;
  if (canvas) {
    // Event listenerlarni qayta bog'laymiz (canvas o'zgarishi mumkin)
    canvas.removeEventListener('click',     onBoardClick);
    canvas.removeEventListener('mousemove', onBoardHover);
    canvas.addEventListener('click',     onBoardClick);
    canvas.addEventListener('mousemove', onBoardHover);
    canvas.addEventListener('mouseleave', () => { hoverCell = null; drawBoard(); });
  }
  resizeCanvas();
  buildCoords();
  updateCaptured(); renderMoveList(); drawBoard(); updateStatus('normal');
}

function newGame() {
  closeModal('end-modal');
  if (gameState.mode==='online') leaveOnlineRoom?.();
  document.getElementById('game-ui')?.classList.add('hidden');
  document.getElementById('mode-select')?.classList.remove('hidden');
}

// ── MINI TAXTA ────────────────────────────────────────────────
function buildMiniBoard() {
  const mb=document.getElementById('mini-board');
  if (!mb) return;
  mb.innerHTML='';
  for (let r=0;r<11;r++) for (let c=0;c<11;c++) {
    const cell=document.createElement('div');
    cell.className='mini-cell '+((r+c)%2===0?'light':'dark');
    mb.appendChild(cell);
  }
}

// ── SAHIFALAR ─────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.add('hidden'));
  document.getElementById(name)?.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l=>
    l.classList.toggle('active',l.getAttribute('href')==='#'+name));
  if (name==='tutorial') setTimeout(()=>initTutorial(),50);
  if (name==='game') {
    document.getElementById('mode-select')?.classList.remove('hidden');
    document.getElementById('game-ui')?.classList.add('hidden');
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

// ── NAVBAR / TIL / I18N ───────────────────────────────────────
window.addEventListener('scroll',()=>{
  document.getElementById('navbar')?.classList.toggle('scrolled',window.scrollY>20);
});

function buildLangDropdown() {
  const dd=document.getElementById('lang-dropdown');
  if (!dd) return;
  dd.innerHTML='';

  // Joriy tilning nomini darhol ko'rsatamiz (sahifa yuklanganda ham to'g'ri chiqishi uchun)
  const activeLang = getAvailableLangs().find(l => l.code === currentLang);
  const nameEl = document.getElementById('current-lang-name');
  if (nameEl && activeLang) nameEl.textContent = activeLang.name;

  getAvailableLangs().forEach(({code,name})=>{
    const btn=document.createElement('button');
    btn.className='lang-option'+(code===currentLang?' active':'');
    btn.textContent=name;
    btn.onclick=()=>{
      setLang(code);
      dd.classList.remove('open');
      document.getElementById('current-lang-name').textContent=name;
      updateAllI18n();
      buildLangDropdown();
      if (document.getElementById('online')?.classList.contains('hidden')===false) {
        loadLeaderboard?.();
      }
      if (typeof updatePuzzleUI === 'function' && puzzleState?.current) updatePuzzleUI();
    };
    dd.appendChild(btn);
  });
}

function updateAllI18n() {
  // Barcha data-i18n elementlarini yangilaymiz
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    const v = t(k);
    if (v && v !== k) el.textContent = v;
  });
  const sn = document.getElementById('nav-site-name');
  if (sn) sn.textContent = t('siteName') || 'Amir Temur Shaxmati';
  document.title = t('siteName') || 'Amir Temur Shaxmati';
  if (gameState.board) updateStatus(gameState.status);

  // Dinamik matnlarni ham yangilaymiz
  const mmBtn = document.getElementById('matchmaking-btn');
  if (mmBtn && !OnlineGame?.state?.queueId) {
    const span = mmBtn.querySelector('[data-i18n="online_find_opponent"]');
    if (span) span.textContent = t('online_find_opponent');
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('lang-btn')?.addEventListener('click',e=>{
    e.stopPropagation();
    document.getElementById('lang-dropdown')?.classList.toggle('open');
  });
  document.addEventListener('click',()=>document.getElementById('lang-dropdown')?.classList.remove('open'));
  document.getElementById('hamburger')?.addEventListener('click',()=>
    document.getElementById('nav-links')?.classList.toggle('mobile-open'));
  document.querySelectorAll('.nav-link').forEach(link=>{
    link.addEventListener('click',e=>{
      e.preventDefault();
      const href=link.getAttribute('href');
      if (href?.startsWith('#')){
        showSection(href.slice(1));
        document.getElementById('nav-links')?.classList.remove('mobile-open');
      }
    });
  });

  // Swap tugmasi
  document.getElementById('swap-btn')?.addEventListener('click',()=>{
    if (gameState.selected && isRoyal(gameState.board?.[gameState.selected.row]?.[gameState.selected.col]?.type)) {
      gameState.swapMode=!gameState.swapMode;
      document.getElementById('swap-btn').classList.toggle('active',gameState.swapMode);
    }
  });

  buildMiniBoard();
  buildLangDropdown();
  updateAllI18n();
  initGame();
  showSection('home');
});

// game.js ning pastiga qo'shing

// Online rejim uchun: tashqaridan hamla qo'llash
window.applyOnlineMove = function(from, to, promotion) {
  applyMove(from.row, from.col, to.row, to.col);
};

// Boshlang'ich taxta holatini qaytarish
window.getInitialBoard = function() {
  return JSON.parse(JSON.stringify(createInitialBoard()));
};