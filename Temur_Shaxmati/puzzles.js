// ============================================================
//  AMIR TEMUR SHAXMATI — puzzles.js  v3
//  ✅ Kunlik 5 ta limit (login bo'lganlar uchun)
//  ✅ Qiyinlik avtomatik oshib boradi (ELO asosida)
//  ✅ Do'stlar leaderboard
// ============================================================

let puzzleState = {
  current:       null,
  moveIndex:     0,
  solved:        false,
  failed:        false,
  attempts:      0,
  difficulty:    'easy',
  playerElo:     1000,   // Foydalanuvchi puzzle ELO si
  dailyCount:    0,      // Bugun qilingan puzzlelar
  dailyLimit:    5,
  limitReached:  false,
};

let pCanvas = null;
let pCtx    = null;
let pCellW  = 50;
let pCellH  = 50;

// ── CANVAS INIT ───────────────────────────────────────────────
function initPuzzleCanvas() {
  pCanvas = document.getElementById('puzzle-board');
  if (!pCanvas) return;
  pCtx = pCanvas.getContext('2d');

  const maxBoard = Math.min(window.innerWidth - 120, 594);
  pCellW = Math.max(36, Math.floor(maxBoard / BOARD_COLS));
  pCellH = pCellW;
  pCanvas.width  = pCellW * BOARD_COLS + (CIT_W + CIT_GAP) * 2;
  pCanvas.height = pCellH * BOARD_ROWS;

  // Eski listenerlarni o'chirib, yangi qo'shamiz
  const newCanvas = pCanvas.cloneNode(false);
  pCanvas.parentNode.replaceChild(newCanvas, pCanvas);
  pCanvas = newCanvas;
  pCtx = pCanvas.getContext('2d');
  pCanvas.width  = pCellW * BOARD_COLS + (CIT_W + CIT_GAP) * 2;
  pCanvas.height = pCellH * BOARD_ROWS;

  pCanvas.addEventListener('click',      onPuzzleClick);
  pCanvas.addEventListener('mousemove',  onPuzzleHover);
  pCanvas.addEventListener('mouseleave', onPuzzleLeave);
}

function onPuzzleLeave() { pHover = null; drawPuzzleBoard(); }

let pHover    = null;
let pLastMove = null;

// ── TAXTA CHIZISH ─────────────────────────────────────────────
function drawPuzzleBoard() {
  if (!pCanvas || !pCtx || !gameState?.board) return;
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  pCtx.save();
  pCtx.translate(CIT_W + CIT_GAP, 0);
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++)
      drawPuzzleCell(r, c);
  drawPuzzleCitadels();
  pCtx.restore();
}

function drawPuzzleCell(r, c) {
  const x = c * pCellW, y = r * pCellH;
  pCtx.fillStyle = (r + c) % 2 === 0 ? CLR.light : CLR.dark;
  pCtx.fillRect(x, y, pCellW, pCellH);

  if (pLastMove) {
    const { fr, fc, tr, tc } = pLastMove;
    if ((r===fr&&c===fc)||(r===tr&&c===tc)) {
      pCtx.fillStyle = CLR.lastMove;
      pCtx.fillRect(x, y, pCellW, pCellH);
    }
  }
  if (gameState.selected?.row===r && gameState.selected?.col===c) {
    pCtx.fillStyle = CLR.selected;
    pCtx.fillRect(x, y, pCellW, pCellH);
  }
  const isLegal = gameState.legalMoves.some(([lr,lc])=>lr===r&&lc===c);
  if (isLegal) {
    if (gameState.board?.[r]?.[c]) {
      pCtx.strokeStyle = 'rgba(180,30,30,0.85)';
      pCtx.lineWidth = 2.5;
      pCtx.strokeRect(x+2, y+2, pCellW-4, pCellH-4);
    } else {
      pCtx.fillStyle = 'rgba(0,0,0,0.22)';
      pCtx.beginPath();
      pCtx.arc(x+pCellW/2, y+pCellH/2, pCellW*0.15, 0, Math.PI*2);
      pCtx.fill();
    }
  }
  if (pHover?.r===r && pHover?.c===c) {
    pCtx.fillStyle = CLR.hover;
    pCtx.fillRect(x, y, pCellW, pCellH);
  }
  if (gameState.board?.[r]?.[c]) drawPuzzlePiece(gameState.board[r][c], x, y);
}

function drawPuzzlePiece(piece, x, y) {
  const savedCtx   = ctx;
  const savedCellW = CELL_W;
  const savedCellH = CELL_H;
  ctx    = pCtx;
  CELL_W = pCellW;
  CELL_H = pCellH;
  drawPiece(piece, x, y);
  ctx    = savedCtx;
  CELL_W = savedCellW;
  CELL_H = savedCellH;
}

function drawPuzzleCitadels() {
  // WHITE citadel: taxta CHAP tomonida, row=1 (qator 9)
  // BLACK citadel: taxta O'NG tomonida, row=8 (qator 2)
  const w = CIT_W * 0.85;
  const h = pCellH;

  // Chap citadel (oq uchun) — translate(CIT_W+CIT_GAP, 0) dan TASHQARIDA
  // pCtx.save qilingan, shuning uchun -CIT_W ga boramiz
  const leftX  = -(CIT_W);
  const leftY  =  CITADEL.WHITE.r * pCellH;
  const rightX =  pCellW * BOARD_COLS + CIT_GAP;
  const rightY =  CITADEL.BLACK.r * pCellH;

  drawCastleShape(leftX,  leftY,  w, h, COLOR.WHITE, gameState.whiteCitadel);
  drawCastleShape(rightX, rightY, w, h, COLOR.BLACK, gameState.blackCitadel);
}

function drawCastleShape(x, y, w, h, owner, occupant) {
  pCtx.save();

  const isWhite  = owner === COLOR.WHITE;
  const wallClr  = isWhite ? '#c8a96e' : '#7a4e2d';
  const shadClr  = isWhite ? 'rgba(255,220,140,0.18)' : 'rgba(120,60,20,0.28)';
  const lineClr  = '#C9A84C';
  const merlonH  = h * 0.22;   // merlon (tish) balandligi
  const merlonW  = w * 0.28;   // merlon kengligi
  const wallY    = y + merlonH;
  const wallH    = h - merlonH;

  // 1. Devor asosi
  pCtx.fillStyle = shadClr;
  pCtx.fillRect(x, wallY, w, wallH);

  // 2. Devor chizig'i (koshina)
  pCtx.strokeStyle = lineClr;
  pCtx.lineWidth = 0.8;
  pCtx.setLineDash([]);
  // Gorizontal chiziqlar
  for (let i = 1; i <= 3; i++) {
    const ly = wallY + (wallH / 4) * i;
    pCtx.beginPath();
    pCtx.moveTo(x, ly);
    pCtx.lineTo(x + w, ly);
    pCtx.globalAlpha = 0.25;
    pCtx.stroke();
  }
  // Vertikal chiziqlar (g'isht)
  for (let i = 1; i <= 2; i++) {
    const lx = x + (w / 3) * i;
    pCtx.beginPath();
    pCtx.moveTo(lx, wallY);
    pCtx.lineTo(lx, y + h);
    pCtx.globalAlpha = 0.2;
    pCtx.stroke();
  }
  pCtx.globalAlpha = 1;

  // 3. Merlon (qal'a tishlari) — 3 ta
  pCtx.fillStyle = wallClr;
  const merlons = 3;
  const totalMW = merlonW * merlons;
  const gap     = (w - totalMW) / (merlons + 1);
  for (let i = 0; i < merlons; i++) {
    const mx = x + gap + i * (merlonW + gap);
    pCtx.fillRect(mx, y, merlonW, merlonH + 2);
  }

  // 4. Devor borderi
  pCtx.strokeStyle = lineClr;
  pCtx.lineWidth = 1.5;
  pCtx.globalAlpha = 0.7;
  pCtx.strokeRect(x + 0.5, wallY + 0.5, w - 1, wallH - 1);
  pCtx.globalAlpha = 1;

  // 5. Eshik (pastki markazda)
  const doorW = w * 0.32;
  const doorH = wallH * 0.38;
  const doorX = x + (w - doorW) / 2;
  const doorY = y + h - doorH;
  pCtx.fillStyle = 'rgba(0,0,0,0.45)';
  pCtx.beginPath();
  pCtx.moveTo(doorX, y + h);
  pCtx.lineTo(doorX, doorY + doorH * 0.35);
  pCtx.arc(doorX + doorW / 2, doorY + doorH * 0.35, doorW / 2, Math.PI, 0);
  pCtx.lineTo(doorX + doorW, y + h);
  pCtx.fill();

  // 6. Egasini ko'rsatish (oq/qora nuqta)
  pCtx.fillStyle = isWhite ? 'rgba(255,240,200,0.5)' : 'rgba(80,40,10,0.5)';
  pCtx.beginPath();
  pCtx.arc(x + w / 2, wallY + wallH * 0.3, w * 0.1, 0, Math.PI * 2);
  pCtx.fill();

  // 7. Agar band bo'lsa — shoh belgisi
  if (occupant) {
    pCtx.font = `bold ${w * 0.42}px serif`;
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillStyle = occupant.color === COLOR.WHITE ? '#fff' : '#1a0a00';
    pCtx.shadowColor = 'rgba(0,0,0,0.6)';
    pCtx.shadowBlur = 3;
    pCtx.fillText('♔', x + w / 2, wallY + wallH * 0.55);
    pCtx.shadowBlur = 0;
  }

  pCtx.restore();
}

// ── MOUSE ─────────────────────────────────────────────────────
function getPuzzleCellFromEvent(e) {
  const rect   = pCanvas.getBoundingClientRect();
  const scaleX = pCanvas.width  / rect.width;
  const scaleY = pCanvas.height / rect.height;
  const rawX   = (e.clientX - rect.left) * scaleX;
  const rawY   = (e.clientY - rect.top)  * scaleY;
  const boardX = rawX - (CIT_W + CIT_GAP);
  return {
    r: Math.floor(rawY   / pCellH),
    c: Math.floor(boardX / pCellW),
  };
}

function onPuzzleHover(e) {
  if (!gameState.board || puzzleState.solved || puzzleState.failed || puzzleState.limitReached) return;
  const { r, c } = getPuzzleCellFromEvent(e);
  if (!inBounds(r,c)) { pHover = null; drawPuzzleBoard(); return; }
  if (pHover?.r !== r || pHover?.c !== c) {
    pHover = { r, c };
    drawPuzzleBoard();
  }
}

function onPuzzleClick(e) {
  if (!gameState.board || puzzleState.solved || puzzleState.failed || puzzleState.limitReached) return;
  const { r, c } = getPuzzleCellFromEvent(e);
  if (!inBounds(r, c)) return;

  const piece = gameState.board[r][c];

  if (gameState.selected && gameState.legalMoves.some(([lr,lc])=>lr===r&&lc===c)) {
    executePuzzleMove(gameState.selected.row, gameState.selected.col, r, c);
    return;
  }
  if (piece) {
    // Rang tekshiruvi — har qanday rang tanlash uchun ruxsat
    gameState.selected   = { row: r, col: c };
    gameState.legalMoves = getLegalMoves(gameState.board, r, c, gameState);
    drawPuzzleBoard();
    return;
  }
  gameState.selected   = null;
  gameState.legalMoves = [];
  drawPuzzleBoard();
}

function executePuzzleMove(fr, fc, tr, tc) {
  const piece = gameState.board[fr][fc];
  gameState.board[tr][tc] = { ...piece, moved: true };
  gameState.board[fr][fc] = null;
  pLastMove = { fr, fc, tr, tc };
  gameState.selected    = null;
  gameState.legalMoves  = [];
  gameState.currentTurn = gameState.currentTurn === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
  drawPuzzleBoard();
  checkPuzzleMove(fr, fc, tr, tc);
}

// ── KUNLIK LIMIT ──────────────────────────────────────────────
async function loadDailyCount() {
  if (!currentUser) {
    puzzleState.dailyCount   = 0;
    puzzleState.limitReached = false;
    return;
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await getSb()
      .from('puzzle_daily')
      .select('count')
      .eq('player_id', currentUser.id)
      .eq('date', today)
      .maybeSingle();

    puzzleState.dailyCount   = data?.count || 0;
    puzzleState.limitReached = puzzleState.dailyCount >= puzzleState.dailyLimit;
  } catch (e) {
    puzzleState.dailyCount   = 0;
    puzzleState.limitReached = false;
  }
  updateDailyUI();
}

async function incrementDailyCount() {
  if (!currentUser) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await getSb()
      .from('puzzle_daily')
      .select('id, count')
      .eq('player_id', currentUser.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      await getSb()
        .from('puzzle_daily')
        .update({ count: existing.count + 1 })
        .eq('id', existing.id);
      puzzleState.dailyCount = existing.count + 1;
    } else {
      await getSb()
        .from('puzzle_daily')
        .insert({ player_id: currentUser.id, date: today, count: 1 });
      puzzleState.dailyCount = 1;
    }
    puzzleState.limitReached = puzzleState.dailyCount >= puzzleState.dailyLimit;
    updateDailyUI();
  } catch (e) {
    console.warn('Daily increment xato:', e.message);
  }
}

function updateDailyUI() {
  const el = document.getElementById('puzzle-daily-counter');
  if (!el) return;

  if (!currentUser) {
    el.textContent = t('puzzle_login_required') || '🔒 Login qiling';
    el.className   = 'puzzle-daily-counter';
    return;
  }

  const done = puzzleState.dailyCount;
  const total = puzzleState.dailyLimit;
  const left  = Math.max(0, total - done);
  const stars = '⭐'.repeat(Math.min(done, total)) + '☆'.repeat(left);
  el.textContent = `${stars}  ${done}/${total}`;
  el.className   = puzzleState.limitReached
    ? 'puzzle-daily-counter limit-reached'
    : 'puzzle-daily-counter';

  const limitEl = document.getElementById('puzzle-limit-msg');
  if (limitEl) limitEl.classList.toggle('hidden', !puzzleState.limitReached);

  // Limit yetganda keyingi puzzle tugmasini yashir
  if (puzzleState.limitReached) {
    document.getElementById('next-puzzle-btn')?.classList.add('hidden');
  }
}

// ── QIYINLIK ADAPTIV (ELO) ────────────────────────────────────
function getAdaptiveDifficulty() {
  const elo = puzzleState.playerElo;
  if (elo < 1100) return 'easy';
  if (elo < 1400) return 'medium';
  return 'hard';
}

function calcEloChange(solved, puzzleElo) {
  const K        = 32;
  const expected = 1 / (1 + Math.pow(10, (puzzleElo - puzzleState.playerElo) / 400));
  const actual   = solved ? 1 : 0;
  return Math.round(K * (actual - expected));
}

async function loadPlayerPuzzleElo() {
  if (!currentUser) return;
  try {
    const { data } = await getSb()
      .from('profiles')
      .select('puzzle_elo')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (data?.puzzle_elo) puzzleState.playerElo = data.puzzle_elo;
  } catch (e) { /* silent */ }
}

async function savePlayerPuzzleElo(newElo) {
  if (!currentUser) return;
  try {
    await getSb()
      .from('profiles')
      .update({ puzzle_elo: newElo })
      .eq('id', currentUser.id);
  } catch (e) { /* silent */ }
}


// ============================================================
//  BOSQICH C — Kunlik 5 ta avtomatik tanlash logikasi
//  puzzles.js ga qo'shiladigan/almashtiriladigan qism
// ============================================================

// ── LOYIHA BOSHLANGAN SANA ─────────────────────────────────────
const PUZZLE_CYCLE_START = '2026-06-21'; // ← loyiha boshlangan sana (o'zgartirmang)
const PUZZLE_DAILY_COUNT = 5;

// ── KUNLIK OFFSET HISOBLASH ────────────────────────────────────
function getDaysSinceCycleStart() {
  const start = new Date(PUZZLE_CYCLE_START + 'T00:00:00Z');
  const today = new Date();
  // Faqat sana (vaqt emas) — server/mahalliy vaqt farqi ta'sir qilmasligi uchun UTC kun boshini olamiz
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffMs   = todayUTC - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// ── BUGUNGI 5 TA PUZZLE ID/NUMBER RO'YXATINI OLISH ─────────────
async function getTodaysPuzzleSelection() {
  // Jami puzzle sonini va puzzle_number bo'yicha tartiblangan ro'yxatni olamiz
  const { data: allPuzzles, error } = await getSb()
    .from('puzzles')
    .select('id, puzzle_number, difficulty, theme, elo, board_json, moves_json, current_turn')
    .order('puzzle_number', { ascending: true });

  if (error) throw error;
  if (!allPuzzles?.length) return [];

  const total = allPuzzles.length;
  const daysPassed = getDaysSinceCycleStart();
  const offset = (daysPassed * PUZZLE_DAILY_COUNT) % total;

  // Aylanma tanlash — offset'dan boshlab PUZZLE_DAILY_COUNT ta
  const selection = [];
  for (let i = 0; i < Math.min(PUZZLE_DAILY_COUNT, total); i++) {
    const idx = (offset + i) % total;
    selection.push(allPuzzles[idx]);
  }
  return selection;
}

// ── PUZZLE YUKLASH (Bosqich C bilan yangilangan) ───────────────
// Eski loadNextPuzzle o'rniga shu versiya ishlatiladi.
// Qiyinlik tugmasi bosilsa — bugungi 5 ta orasidan shu qiyinlikka mosini tanlaydi.
// Aks holda — bugungi 5 tadan navbat bilan (hali ko'rilmaganidan) birini beradi.

let _todaysPuzzles = null;       // cache: bugungi 5 ta puzzle obyekti
let _todaysPuzzleIndex = 0;      // navbatdagi indeks

async function loadNextPuzzle(forceDifficulty) {
  if (!currentUser) {
    showPuzzleHint(t('puzzle_login_required') || '🔒 Puzzle uchun login qiling!', 'info');
    return;
  }
  if (puzzleState.limitReached) {
    showPuzzleLimitMessage();
    return;
  }

  // Oldingi puzzle state ni tozalaymiz
  puzzleState.current   = null;
  puzzleState.solved    = false;
  puzzleState.failed    = false;
  puzzleState.attempts  = 0;
  puzzleState.moveIndex = 0;
  document.getElementById('next-puzzle-btn')?.classList.add('hidden');
  document.getElementById('puzzle-hint')?.classList.add('hidden');

  const statusEl = document.getElementById('puzzle-status');
  if (statusEl) statusEl.textContent = t('loading') || 'Yuklanmoqda...';

  try {
    // Bugungi 5 tani (cache bo'lmasa) yuklaymiz
    if (!_todaysPuzzles) {
      _todaysPuzzles = await getTodaysPuzzleSelection();
      _todaysPuzzleIndex = 0;
    }

    if (!_todaysPuzzles?.length) {
      // Bazada hali puzzle yo'q — demo bilan davom etamiz
      loadDemoPuzzle();
      return;
    }

    let chosen = null;

    if (forceDifficulty) {
      // Foydalanuvchi qiyinlik tugmasini bosgan — bugungi 5 ta orasidan mos qiyinlikni qidiramiz
      chosen = _todaysPuzzles.find(p => p.difficulty === forceDifficulty);
      if (!chosen) {
        // Bugungi 5 ta orasida bu qiyinlik yo'q — baribir birini beramiz
        chosen = _todaysPuzzles[_todaysPuzzleIndex % _todaysPuzzles.length];
        _todaysPuzzleIndex++;
      }
      puzzleState.difficulty = forceDifficulty;
    } else {
      // Navbat bilan — bugungi ro'yxatdan ketma-ket
      chosen = _todaysPuzzles[_todaysPuzzleIndex % _todaysPuzzles.length];
      _todaysPuzzleIndex++;
      puzzleState.difficulty = chosen.difficulty;
    }

    document.querySelectorAll('.puzzle-diff-btns .diff-btn').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-diff') === puzzleState.difficulty));

    applyPuzzle({
      id:          chosen.id,
      board:       JSON.parse(chosen.board_json),
      moves:       JSON.parse(chosen.moves_json),
      currentTurn: chosen.current_turn === 'black' ? COLOR.BLACK : COLOR.WHITE,
      difficulty:  chosen.difficulty,
      elo:         chosen.elo,
      theme:       chosen.theme,
    });
  } catch (e) {
    console.warn('Puzzle DB xato:', e.message);
    loadDemoPuzzle();
  }
}



// ── DEMO PUZZLE LO'NASI ───────────────────────────────────────
// Har biri tekshirilgan: oq shoh tahdidsiz, barcha donalar yura oladi
const DEMO_PUZZLES = [
  {
    // Puzzle 1: Rook bilan shohni qamalga olish
    // Oq: Sh(d7/r3c3), Rook(a4/r6c0) | Qora: Sh(d3/r7c3), Knight(c5/r5c2)
    // Yechim: Ra4→Ra3 (r6c0 → r7c0)
    id: 'demo-1',
    setup: (B, p) => {
      B[3][3] = p(COLOR.WHITE, PIECE.KING);
      B[6][0] = p(COLOR.WHITE, PIECE.ROOK);
      B[7][3] = p(COLOR.BLACK, PIECE.KING);
      B[5][2] = p(COLOR.BLACK, PIECE.KNIGHT);
    },
    currentTurn: COLOR.WHITE,
    moves: [{ fr: 6, fc: 0, tr: 7, tc: 0 }],
    elo: 900, theme: 'tactics',
  },
  {
    // Puzzle 2: Knight bilan vil (fork)
    // Oq: Sh(a1/r9c0), Knight(e5/r5c4) | Qora: Sh(h8/r2c7), Rook(h6/r4c7)
    // Yechim: Nf7 (r5c4 → r3c5) — Sh va Rook ga fork
    id: 'demo-2',
    setup: (B, p) => {
      B[9][0] = p(COLOR.WHITE, PIECE.KING);
      B[5][4] = p(COLOR.WHITE, PIECE.KNIGHT);
      B[2][7] = p(COLOR.BLACK, PIECE.KING);
      B[4][7] = p(COLOR.BLACK, PIECE.ROOK);
    },
    currentTurn: COLOR.WHITE,
    moves: [{ fr: 5, fc: 4, tr: 3, tc: 5 }],
    elo: 1000, theme: 'fork',
  },
  {
    // Puzzle 3: Rook bilan mat
    // Oq: Sh(a1/r9c0), Rook1(b8/r2c1), Rook2(c9/r1c2)
    // Qora: Sh(k10/r0c10)
    // Yechim: Rb8→Rk8 (r2c1 → r2c10) — shoh qamalda
    id: 'demo-3',
    setup: (B, p) => {
      B[9][0]  = p(COLOR.WHITE, PIECE.KING);
      B[2][1]  = p(COLOR.WHITE, PIECE.ROOK);
      B[1][2]  = p(COLOR.WHITE, PIECE.ROOK);
      B[0][10] = p(COLOR.BLACK, PIECE.KING);
    },
    currentTurn: COLOR.WHITE,
    moves: [{ fr: 2, fc: 1, tr: 2, tc: 10 }],
    elo: 1100, theme: 'checkmate',
  },
  {
    // Puzzle 4: Ferz bilan dona yutish
    // Oq: Sh(a1/r9c0), Ferz(d5/r5c3) | Qora: Sh(k10/r0c10), Rook(h5/r5c7)
    // Yechim: Ferz d5→h5 (r5c3 → r5c7) — rook yutish
    id: 'demo-4',
    setup: (B, p) => {
      B[9][0]  = p(COLOR.WHITE, PIECE.KING);
      B[5][3]  = p(COLOR.WHITE, PIECE.FERZ);
      B[0][10] = p(COLOR.BLACK, PIECE.KING);
      B[5][7]  = p(COLOR.BLACK, PIECE.ROOK);
    },
    currentTurn: COLOR.WHITE,
    moves: [{ fr: 5, fc: 3, tr: 5, tc: 7 }],
    elo: 950, theme: 'tactics',
  },
  {
    // Puzzle 5: Elephant sakrash
    // Oq: Sh(a1/r9c0), Elephant(c3/r7c2) | Qora: Sh(k10/r0c10), Knight(e5/r5c4)
    // Yechim: Elephant c3→e5 (r7c2 → r5c4) — knight yutish
    id: 'demo-5',
    setup: (B, p) => {
      B[9][0]  = p(COLOR.WHITE, PIECE.KING);
      B[7][2]  = p(COLOR.WHITE, PIECE.ELEPHANT);
      B[0][10] = p(COLOR.BLACK, PIECE.KING);
      B[5][4]  = p(COLOR.BLACK, PIECE.KNIGHT);
    },
    currentTurn: COLOR.WHITE,
    moves: [{ fr: 7, fc: 2, tr: 5, tc: 4 }],
    elo: 1050, theme: 'tactics',
  },
];

let _demoIndex = 0;  // Navbatdagi demo puzzle indeksi

function loadDemoPuzzle() {
  const template = DEMO_PUZZLES[_demoIndex % DEMO_PUZZLES.length];
  _demoIndex++;

  const B = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const p = (color, type) => ({ color, type, moved: true, promoteCount: 0 });
  template.setup(B, p);

  applyPuzzle({
    id:          template.id,
    board:       B,
    currentTurn: template.currentTurn,
    moves:       template.moves,
    difficulty:  puzzleState.difficulty,
    elo:         template.elo,
    theme:       template.theme,
  });
}

function applyPuzzle(puzzle) {
  puzzleState.current   = puzzle;
  puzzleState.moveIndex = 0;
  puzzleState.solved    = false;
  puzzleState.failed    = false;
  puzzleState.attempts  = 0;
  pLastMove             = null;

  // Puzzle o'z pozitsiyasiga ega bo'lsa — uni ishlat
  // Yo'q bo'lsa — boshlang'ich taxta (DB dan kelgan puzzlelar uchun board_position kerak)
  gameState.board        = puzzle.board || createInitialBoard();
  gameState.currentTurn  = puzzle.currentTurn || COLOR.WHITE;
  gameState.selected     = null;
  gameState.legalMoves   = [];
  gameState.gameOver     = false;
  gameState.whiteCitadel = null;
  gameState.blackCitadel = null;
  gameState.mode         = 'puzzle';

  if (!pCanvas || !pCtx) initPuzzleCanvas();

  // Canvas tayyor bo'lgunicha kichik kutish
  setTimeout(() => {
    drawPuzzleBoard();
    updatePuzzleUI();
  }, 30);

  const hint = document.getElementById('puzzle-hint');
  if (hint) hint.classList.add('hidden');
  document.getElementById('next-puzzle-btn')?.classList.add('hidden');
}

// ── HAMLA TEKSHIRUVI ──────────────────────────────────────────
// ── HAMLA TEKSHIRUVI ──────────────────────────────────────────
function checkPuzzleMove(fr, fc, tr, tc) {
  if (!puzzleState.current || puzzleState.solved || puzzleState.failed) return;

  const expected = puzzleState.current.moves[puzzleState.moveIndex];
  if (!expected) return;

  if (fr===expected.fr && fc===expected.fc && tr===expected.tr && tc===expected.tc) {
    puzzleState.moveIndex++;
    if (puzzleState.moveIndex >= puzzleState.current.moves.length) {
      puzzleSolved();
    } else {
      showPuzzleHint('✓ ' + (t('puzzle_correct') || "To'g'ri! Davom eting"), 'success');
      // Keyingi hamla raqibniki bo'lsa — 800ms dan keyin avtomatik bajaramiz
      // Toq indekslar (1, 3, 5...) — raqib hamlalari
      if (puzzleState.moveIndex % 2 === 1) {
        setTimeout(() => autoPlayOpponentMove(), 800);
      }
    }
  } else {
    puzzleState.attempts++;
    if (puzzleState.attempts >= 3) {
      puzzleState.failed = true;
      puzzleFailed();
    } else {
      const left = 3 - puzzleState.attempts;
      showPuzzleHint(
        `✗ ${t('puzzle_wrong')||"Noto'g'ri"}. ${left} ${t('puzzle_tries_left')||'urinish qoldi'}`,
        'error'
      );
      setTimeout(() => {
        gameState.board[fr][fc] = gameState.board[tr][tc];
        gameState.board[tr][tc] = null;
        if (gameState.board[fr][fc]) gameState.board[fr][fc].moved = false;
        gameState.currentTurn = gameState.currentTurn===COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
        pLastMove            = null;
        gameState.selected   = null;
        gameState.legalMoves = [];
        drawPuzzleBoard();
      }, 600);
    }
  }
}

// ── RAQIB HAMLASINI AVTOMATIK BAJARISH ───────────────────────
function autoPlayOpponentMove() {
  if (puzzleState.solved || puzzleState.failed) return;
  const move = puzzleState.current.moves[puzzleState.moveIndex];
  if (!move) return;

  const piece = gameState.board[move.fr][move.fc];
  if (!piece) return;

  gameState.board[move.tr][move.tc] = { ...piece, moved: true };
  gameState.board[move.fr][move.fc] = null;
  pLastMove = { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc };
  gameState.currentTurn = gameState.currentTurn === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
  gameState.selected    = null;
  gameState.legalMoves  = [];
  puzzleState.moveIndex++;
  drawPuzzleBoard();

  if (puzzleState.moveIndex >= puzzleState.current.moves.length) {
    // Raqibning oxirgi hamlasi bo'lsa — puzzle yechildi
    setTimeout(() => puzzleSolved(), 300);
  } else {
    showPuzzleHint('✓ ' + (t('puzzle_correct') || "To'g'ri! Davom eting"), 'success');
    // Agar yana raqib hamlasi bo'lsa (ketma-ket) — yana avtomatik
    if (puzzleState.moveIndex % 2 === 1) {
      setTimeout(() => autoPlayOpponentMove(), 800);
    }
  }
}

async function puzzleSolved() {
  puzzleState.solved = true;
  const eloChange = calcEloChange(true, puzzleState.current?.elo || 1000);
  puzzleState.playerElo = Math.max(100, puzzleState.playerElo + eloChange);

  showPuzzleHint(
    `🎉 ${t('puzzle_solved')||'Ajoyib!'} ${eloChange > 0 ? '+' : ''}${eloChange} ELO`,
    'success'
  );
  updatePuzzleEloDisplay();

  if (currentUser && puzzleState.current?.id !== 'demo-1') {
    try {
      await getSb().from('puzzle_attempts').upsert({
        player_id: currentUser.id,
        puzzle_id: puzzleState.current.id,
        solved:    true,
        attempts:  puzzleState.attempts + 1,
        solved_at: new Date().toISOString(),
      }, { onConflict: 'player_id,puzzle_id' });

      await incrementDailyCount();
      await savePlayerPuzzleElo(puzzleState.playerElo);
      await _incrementPuzzleSolvedCount();
      loadFriendsLeaderboard();
    } catch (e) {
      console.warn('Puzzle save xato:', e.message);
    }
  }

  if (!puzzleState.limitReached) {
    setTimeout(() => document.getElementById('next-puzzle-btn')?.classList.remove('hidden'), 1200);
  }
}

async function puzzleFailed() {
  const eloChange = calcEloChange(false, puzzleState.current?.elo || 1000);
  puzzleState.playerElo = Math.max(100, puzzleState.playerElo + eloChange);

  showPuzzleSolution();
  updatePuzzleEloDisplay();

  if (currentUser && puzzleState.current?.id !== 'demo-1') {
    try {
      await getSb().from('puzzle_attempts').upsert({
        player_id: currentUser.id,
        puzzle_id: puzzleState.current.id,
        solved:    false,
        attempts:  puzzleState.attempts,
        solved_at: new Date().toISOString(),
      }, { onConflict: 'player_id,puzzle_id' });

      await incrementDailyCount();
      await savePlayerPuzzleElo(puzzleState.playerElo);
      loadFriendsLeaderboard();
    } catch (e) {
      console.warn('Puzzle fail save xato:', e.message);
    }
  }

  if (!puzzleState.limitReached) {
    setTimeout(() => document.getElementById('next-puzzle-btn')?.classList.remove('hidden'), 1500);
  }
}

async function _incrementPuzzleSolvedCount() {
  if (!currentUser) return;
  try {
    const { data } = await getSb()
      .from('profiles').select('puzzle_solved').eq('id', currentUser.id).maybeSingle();
    await getSb()
      .from('profiles')
      .update({ puzzle_solved: (data?.puzzle_solved || 0) + 1 })
      .eq('id', currentUser.id);
  } catch (e) { /* silent */ }
}

function showPuzzleSolution() {
  if (!puzzleState.current) return;
  const sol = puzzleState.current.moves.map(m => formatPuzzleMove(m)).join(' → ');
  showPuzzleHint(`${t('puzzle_answer')||'Javob'}: ${sol}`, 'info');
  document.getElementById('next-puzzle-btn')?.classList.remove('hidden');
}

function formatPuzzleMove(m) {
  const cols = 'abcdefghijk';
  return `${cols[m.fc]}${BOARD_ROWS - m.fr} → ${cols[m.tc]}${BOARD_ROWS - m.tr}`;
}

function showPuzzleHint(msg, type) {
  const el = document.getElementById('puzzle-hint');
  if (!el) return;
  el.textContent = msg;
  el.className   = `puzzle-hint puzzle-hint-${type}`;
  el.classList.remove('hidden');
}

function showPuzzleLimitMessage() {
  showPuzzleHint(
    `⏰ ${t('puzzle_daily_limit')||'Bugunlik limitga yetdingiz!'} ` +
    `(${puzzleState.dailyLimit}/${puzzleState.dailyLimit}). ` +
    `${t('puzzle_come_tomorrow')||'Ertaga qaytib keling! 🌙'}`,
    'info'
  );
}

// ── DO'STLAR LEADERBOARD ──────────────────────────────────────
async function loadFriendsLeaderboard() {
  const tbody = document.getElementById('puzzle-friends-lb-body');
  if (!tbody) return;

  if (!currentUser) {
    tbody.innerHTML = `<tr><td colspan="4" class="lb-empty">
      ${t('puzzle_login_required')||"Ko'rish uchun login qiling"}</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" class="lb-empty lb-loading">
    <div class="thinking-dots"><span></span><span></span><span></span></div></td></tr>`;

  try {
    // Do'stlar ID larini olamiz
    const { data: friends } = await getSb()
      .from('friends_list')
      .select('friend_id');

    const friendIds = (friends || []).map(f => f.friend_id);
    const allIds    = [currentUser.id, ...friendIds];

    const { data: profiles } = await getSb()
      .from('profiles')
      .select('id, nickname, puzzle_elo, puzzle_solved')
      .in('id', allIds)
      .order('puzzle_elo', { ascending: false });

    if (!profiles?.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="lb-empty">
        ${t('puzzle_no_friends')||"Hali do'stlar yo'q"}</td></tr>`;
      return;
    }

    tbody.innerHTML = profiles.map((p, i) => {
      const isMe  = p.id === currentUser.id;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      return `<tr class="${isMe ? 'lb-me' : ''}">
        <td class="lb-rank">${medal}</td>
        <td class="lb-nick">${isMe ? '👤 ' : ''}${p.nickname || '—'}</td>
        <td class="lb-elo">${p.puzzle_elo || 1000}</td>
        <td class="lb-games">${p.puzzle_solved || 0}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="lb-empty">Yuklab bo'lmadi</td></tr>`;
  }
}

// ── UI YANGILASH ──────────────────────────────────────────────
function updatePuzzleUI() {
  const p = puzzleState.current;
  if (!p) return;

  const diffNames = {
    easy:   t('game_diff_easy')   || 'Oson',
    medium: t('game_diff_medium') || "O'rta",
    hard:   t('game_diff_hard')   || 'Qiyin',
  };

  const diffEl   = document.getElementById('puzzle-difficulty');
  const eloEl    = document.getElementById('puzzle-elo');
  const themeEl  = document.getElementById('puzzle-theme');
  const statusEl = document.getElementById('puzzle-status');

  if (diffEl)   diffEl.textContent  = diffNames[p.difficulty] || p.difficulty;
  if (eloEl)    eloEl.textContent   = p.elo || '?';
  if (themeEl)  themeEl.textContent = p.theme || (t('puzzle_theme_general') || 'Taktika');
  if (statusEl) statusEl.textContent =
    gameState.currentTurn === COLOR.WHITE
      ? (t('puzzle_find_best')       || 'Oqlar uchun eng yaxshi hamla?')
      : (t('puzzle_find_best_black') || 'Qoralar uchun eng yaxshi hamla?');

  updatePuzzleEloDisplay();
  updateDailyUI();
}

function updatePuzzleEloDisplay() {
  const el = document.getElementById('puzzle-player-elo');
  if (el) el.textContent = puzzleState.playerElo;
  const diffEl = document.getElementById('puzzle-adaptive-diff');
  if (diffEl) {
    const diffNames = {
     easy:   t('game_diff_easy')   || 'Oson',
     medium: t('game_diff_medium') || "O'rta",
     hard:   t('game_diff_hard')   || 'Qiyin',
};
    diffEl.textContent = diffNames[getAdaptiveDifficulty()] || '';
  }
}

// ── PUZZLE SECTION OCHILGANDA ─────────────────────────────────
async function onPuzzleSectionOpen() {
  // Canvas ni section ko'ringandan keyin init qilamiz
  setTimeout(() => initPuzzleCanvas(), 10);

  // gameState ni puzzle rejimiga o'tkazamiz
  gameState.mode         = 'puzzle';
  gameState.selected     = null;
  gameState.legalMoves   = [];
  gameState.aiThinking   = false;

  if (currentUser) {
    await loadPlayerPuzzleElo();
    await loadDailyCount();
  }

  updateDailyUI();
  updatePuzzleEloDisplay();
  loadFriendsLeaderboard();

  if (puzzleState.limitReached) {
    showPuzzleLimitMessage();
    if (gameState.board) setTimeout(() => drawPuzzleBoard(), 60);
    return;
  }

  if (!puzzleState.current) {
    setTimeout(() => loadNextPuzzle(), 60);
  } else {
    // Mavjud puzzleni qayta yuklash — board va mode to'g'rilash
    gameState.board       = puzzleState.current.board || gameState.board;
    gameState.gameOver    = false;
    setTimeout(() => { drawPuzzleBoard(); updatePuzzleUI(); }, 60);
  }
}
