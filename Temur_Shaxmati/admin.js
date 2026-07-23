// ============================================================
//  AMIR TEMUR SHAXMATI — admin.js
//  Admin panel: vizual taxta orqali puzzle qo'shish
// ============================================================

const adminState = {
  isAdmin:      false,
  mode:         'place',   // 'place' | 'solution'
  selectedPiece: null,     // { color, type } — qo'yiladigan dona
  board:        null,      // 10 x 11 massiv — joriy ko'rinish (animatsiya uchun)
  initialBoard: null,      // 10 x 11 massiv — puzzle BOSHLANG'ICH holati (saqlash uchun)
  moves:        [],        // yechim hamlalari [{fr,fc,tr,tc}, ...]
  moveFrom:     null,      // { r, c } — birinchi klik
  difficulty:   'easy',
  theme:        'tactics',
  currentTurn:  'white',
};

let aCanvas = null;
let aCtx    = null;
let aCellW  = 54;
let aCellH  = 54;

// ── ADMIN TEKSHIRUVI ──────────────────────────────────────────
async function checkAdminAccess() {
  if (!currentUser) return false;
  try {
    const { data } = await getSb()
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .maybeSingle();
    return data?.is_admin === true;
  } catch { return false; }
}

async function onAdminSectionOpen() {
  const wrap = document.getElementById('admin-wrap');
  const deny = document.getElementById('admin-deny');
  if (!wrap || !deny) return;

  adminState.isAdmin = await checkAdminAccess();

  if (!adminState.isAdmin) {
    wrap.classList.add('hidden');
    deny.classList.remove('hidden');
    return;
  }
  deny.classList.add('hidden');
  wrap.classList.remove('hidden');

  buildAdminPalette();
  adminInitBoard();
  setTimeout(() => {
    initAdminCanvas();
    drawAdminBoard();
  }, 50);

  await loadAdminPuzzleList();
}

// ── BOSHLANGHICH TAXTA ────────────────────────────────────────
function adminInitBoard() {
  adminState.board = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(null)
  );
  adminState.initialBoard = null;
  adminState.moves    = [];
  adminState.moveFrom = null;
  adminState.mode     = 'place';
  updateAdminModeUI();
  updateAdminMoveList();
}

// ── CANVAS ────────────────────────────────────────────────────
function initAdminCanvas() {
  aCanvas = document.getElementById('admin-board');
  if (!aCanvas) return;

  const maxW = Math.min(window.innerWidth - 360, 660);
  aCellW = Math.max(36, Math.floor(maxW / BOARD_COLS));
  aCellH = aCellW;
  aCanvas.width  = aCellW * BOARD_COLS + (CIT_W + CIT_GAP) * 2;
  aCanvas.height = aCellH * BOARD_ROWS;

  // Listener ni yangilash
  const fresh = aCanvas.cloneNode(false);
  aCanvas.parentNode.replaceChild(fresh, aCanvas);
  aCanvas = fresh;
  aCtx = aCanvas.getContext('2d');
  aCanvas.width  = aCellW * BOARD_COLS + (CIT_W + CIT_GAP) * 2;
  aCanvas.height = aCellH * BOARD_ROWS;

  aCanvas.addEventListener('click',      onAdminClick);
  aCanvas.addEventListener('contextmenu', onAdminRightClick);
  aCanvas.addEventListener('mousemove',  onAdminHover);
  aCanvas.addEventListener('mouseleave', () => { aHover = null; drawAdminBoard(); });
}

let aHover = null;

function drawAdminBoard() {
  if (!aCanvas || !aCtx) return;
  aCtx.clearRect(0, 0, aCanvas.width, aCanvas.height);
  aCtx.save();
  aCtx.translate(CIT_W + CIT_GAP, 0);

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const x = c * aCellW, y = r * aCellH;

      // Katak rangi
      aCtx.fillStyle = (r + c) % 2 === 0 ? CLR.light : CLR.dark;
      aCtx.fillRect(x, y, aCellW, aCellH);

      // Solution modida — moveFrom highlight
      if (adminState.mode === 'solution' && adminState.moveFrom) {
        const { r: mr, c: mc } = adminState.moveFrom;
        if (r === mr && c === mc) {
          aCtx.fillStyle = CLR.selected;
          aCtx.fillRect(x, y, aCellW, aCellH);
        }
      }

      // Hover
      if (aHover?.r === r && aHover?.c === c) {
        aCtx.fillStyle = CLR.hover;
        aCtx.fillRect(x, y, aCellW, aCellH);
      }

      // Dona
      if (adminState.board?.[r]?.[c]) {
        drawAdminPiece(adminState.board[r][c], x, y);
      }

      // Koordinatlar
      if (c === 0) {
        aCtx.fillStyle = 'rgba(180,140,60,0.7)';
        aCtx.font = `${aCellW * 0.22}px Inter`;
        aCtx.textAlign = 'left';
        aCtx.textBaseline = 'top';
        aCtx.fillText(BOARD_ROWS - r, x + 2, y + 2);
      }
      if (r === BOARD_ROWS - 1) {
        const cols = 'abcdefghijk';
        aCtx.fillStyle = 'rgba(180,140,60,0.7)';
        aCtx.font = `${aCellW * 0.22}px Inter`;
        aCtx.textAlign = 'right';
        aCtx.textBaseline = 'bottom';
        aCtx.fillText(cols[c], x + aCellW - 2, y + aCellH - 2);
      }
    }
  }
  drawAdminCitadels();
  aCtx.restore();
}

// ── CITADELLAR ────────────────────────────────────────────────
function drawAdminCitadels() {
  const w = CIT_W * 0.85;
  const h = aCellH;

  const leftX  = -(CIT_W);
  const leftY  =  CITADEL.WHITE.r * aCellH;
  const rightX =  aCellW * BOARD_COLS + CIT_GAP;
  const rightY =  CITADEL.BLACK.r * aCellH;

  drawAdminCastleShape(leftX,  leftY,  w, h, COLOR.WHITE);
  drawAdminCastleShape(rightX, rightY, w, h, COLOR.BLACK);
}

function drawAdminCastleShape(x, y, w, h, owner) {
  aCtx.save();

  const isWhite  = owner === COLOR.WHITE;
  const wallClr  = isWhite ? '#c8a96e' : '#7a4e2d';
  const shadClr  = isWhite ? 'rgba(255,220,140,0.18)' : 'rgba(120,60,20,0.28)';
  const lineClr  = '#C9A84C';
  const merlonH  = h * 0.22;
  const merlonW  = w * 0.28;
  const wallY    = y + merlonH;
  const wallH    = h - merlonH;

  aCtx.fillStyle = shadClr;
  aCtx.fillRect(x, wallY, w, wallH);

  aCtx.strokeStyle = lineClr;
  aCtx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    const ly = wallY + (wallH / 4) * i;
    aCtx.beginPath();
    aCtx.moveTo(x, ly);
    aCtx.lineTo(x + w, ly);
    aCtx.globalAlpha = 0.25;
    aCtx.stroke();
  }
  for (let i = 1; i <= 2; i++) {
    const lx = x + (w / 3) * i;
    aCtx.beginPath();
    aCtx.moveTo(lx, wallY);
    aCtx.lineTo(lx, y + h);
    aCtx.globalAlpha = 0.2;
    aCtx.stroke();
  }
  aCtx.globalAlpha = 1;

  aCtx.fillStyle = wallClr;
  const merlons = 3;
  const totalMW = merlonW * merlons;
  const gap     = (w - totalMW) / (merlons + 1);
  for (let i = 0; i < merlons; i++) {
    const mx = x + gap + i * (merlonW + gap);
    aCtx.fillRect(mx, y, merlonW, merlonH + 2);
  }

  aCtx.strokeStyle = lineClr;
  aCtx.lineWidth = 1.5;
  aCtx.globalAlpha = 0.7;
  aCtx.strokeRect(x + 0.5, wallY + 0.5, w - 1, wallH - 1);
  aCtx.globalAlpha = 1;

  const doorW = w * 0.32;
  const doorH = wallH * 0.38;
  const doorX = x + (w - doorW) / 2;
  const doorY = y + h - doorH;
  aCtx.fillStyle = 'rgba(0,0,0,0.45)';
  aCtx.beginPath();
  aCtx.moveTo(doorX, y + h);
  aCtx.lineTo(doorX, doorY + doorH * 0.35);
  aCtx.arc(doorX + doorW / 2, doorY + doorH * 0.35, doorW / 2, Math.PI, 0);
  aCtx.lineTo(doorX + doorW, y + h);
  aCtx.fill();

  aCtx.fillStyle = isWhite ? 'rgba(255,240,200,0.5)' : 'rgba(80,40,10,0.5)';
  aCtx.beginPath();
  aCtx.arc(x + w / 2, wallY + wallH * 0.3, w * 0.1, 0, Math.PI * 2);
  aCtx.fill();

  aCtx.restore();
}

function drawAdminPiece(piece, x, y) {
  const savedCtx   = ctx;
  const savedCellW = CELL_W;
  const savedCellH = CELL_H;
  ctx    = aCtx;
  CELL_W = aCellW;
  CELL_H = aCellH;
  drawPiece(piece, x, y);
  ctx    = savedCtx;
  CELL_W = savedCellW;
  CELL_H = savedCellH;
}

// ── MOUSE ─────────────────────────────────────────────────────
function getAdminCell(e) {
  const rect   = aCanvas.getBoundingClientRect();
  const scaleX = aCanvas.width  / rect.width;
  const scaleY = aCanvas.height / rect.height;
  const rawX   = (e.clientX - rect.left) * scaleX;
  const rawY   = (e.clientY - rect.top)  * scaleY;
  return {
    r: Math.floor(rawY / aCellH),
    c: Math.floor((rawX - (CIT_W + CIT_GAP)) / aCellW),
  };
}

function onAdminHover(e) {
  const { r, c } = getAdminCell(e);
  if (!inBounds(r, c)) { aHover = null; }
  else if (aHover?.r !== r || aHover?.c !== c) aHover = { r, c };
  drawAdminBoard();
}

function onAdminRightClick(e) {
  e.preventDefault();
  const { r, c } = getAdminCell(e);
  if (!inBounds(r, c)) return;
  // O'ng klik — donani o'chirish
  adminState.board[r][c] = null;
  drawAdminBoard();
}

function onAdminClick(e) {
  const { r, c } = getAdminCell(e);
  if (!inBounds(r, c)) return;

  if (adminState.mode === 'place') {
    handlePlaceClick(r, c);
  } else {
    handleSolutionClick(r, c);
  }
}

// ── JOY QO'YISH REJIMI ────────────────────────────────────────
function handlePlaceClick(r, c) {
  const sel = adminState.selectedPiece;
  if (!sel) {
    // Dona tanlangan emas — mavjud donani ko'chirish
    if (adminState.board[r][c]) {
      // Tanlash
      adminState.moveFrom = { r, c };
    } else if (adminState.moveFrom) {
      const { r: fr, c: fc } = adminState.moveFrom;
      adminState.board[r][c] = { ...adminState.board[fr][fc] };
      adminState.board[fr][fc] = null;
      adminState.moveFrom = null;
    }
    drawAdminBoard();
    return;
  }
  // Dona qo'yish
  adminState.board[r][c] = {
    color:        sel.color,
    type:         sel.type,
    moved:        true,
    promoteCount: 0,
  };
  drawAdminBoard();
}

// ── YECHIM REJIMI ─────────────────────────────────────────────
function handleSolutionClick(r, c) {
  if (!adminState.moveFrom) {
    // Birinchi klik — "dari" klatka
    if (!adminState.board[r][c]) return;
    adminState.moveFrom = { r, c };
    drawAdminBoard();
  } else {
    // Ikkinchi klik — "ga" klatka
    const { r: fr, c: fc } = adminState.moveFrom;
    if (fr === r && fc === c) {
      adminState.moveFrom = null;
      drawAdminBoard();
      return;
    }
    // Hamlani qo'sh
    adminState.moves.push({ fr, fc, tr: r, tc: c });
    // Vizual ko'rsatish uchun donani ko'chiramiz
    adminState.board[r][c]    = { ...adminState.board[fr][fc] };
    adminState.board[fr][fc]  = null;
    adminState.moveFrom       = null;
    drawAdminBoard();
    updateAdminMoveList();
  }
}

// ── UI BOSHQARUV ──────────────────────────────────────────────
function selectAdminPiece(color, type) {
  adminState.selectedPiece = { color, type };
  adminState.moveFrom      = null;

  // Aktiv ko'rinish
  document.querySelectorAll('.apc-btn').forEach(b => b.classList.remove('active'));
  const key = `${color}-${type}`;
  document.querySelector(`.apc-btn[data-key="${key}"]`)?.classList.add('active');

  // Kursor
  if (aCanvas) aCanvas.style.cursor = 'crosshair';
}

function deselectAdminPiece() {
  adminState.selectedPiece = null;
  document.querySelectorAll('.apc-btn').forEach(b => b.classList.remove('active'));
  if (aCanvas) aCanvas.style.cursor = 'default';
}

function setAdminMode(mode) {
  // 'place' dan 'solution' ga birinchi marta o'tilganda — joriy pozitsiyani
  // boshlang'ich holat sifatida "muzlatib" qo'yamiz (saqlashda shu ishlatiladi)
  if (mode === 'solution' && !adminState.initialBoard) {
    adminState.initialBoard = adminState.board.map(row => row.map(cell => cell ? { ...cell } : null));
  }
  // Agar admin yana 'place' rejimiga qaytsa va donalarni o'zgartirsa,
  // initialBoard eskirgan bo'lib qoladi — shuning uchun 'place' ga qaytganda
  // va hali hech qanday hamla belgilanmagan bo'lsa, initialBoard ni tozalaymiz
  if (mode === 'place' && adminState.moves.length === 0) {
    adminState.initialBoard = null;
  }

  adminState.mode     = mode;
  adminState.moveFrom = null;
  deselectAdminPiece();
  updateAdminModeUI();
  drawAdminBoard();
}

function updateAdminModeUI() {
  const placeBtn = document.getElementById('admin-mode-place');
  const solBtn   = document.getElementById('admin-mode-solution');
  if (placeBtn) placeBtn.classList.toggle('active', adminState.mode === 'place');
  if (solBtn)   solBtn.classList.toggle('active',   adminState.mode === 'solution');

  const placePalette = document.getElementById('admin-palette');
  const solPanel     = document.getElementById('admin-solution-panel');
  if (placePalette) placePalette.classList.toggle('hidden', adminState.mode !== 'place');
  if (solPanel)     solPanel.classList.toggle('hidden',     adminState.mode !== 'solution');

  const hint = document.getElementById('admin-board-hint');
  if (hint) {
    hint.textContent = adminState.mode === 'place'
      ? '💡 Chap klik: dona qo\'y | O\'ng klik: o\'chir'
      : '💡 1-klik: dona tanlash | 2-klik: borish joyi';
  }
}

function updateAdminMoveList() {
  const ul = document.getElementById('admin-moves-list');
  if (!ul) return;
  const cols = 'abcdefghijk';
  if (!adminState.moves.length) {
    ul.innerHTML = '<li class="admin-move-empty">Hali hamla yo\'q</li>';
    return;
  }
  ul.innerHTML = adminState.moves.map((m, i) =>
    `<li class="admin-move-item">
      <span class="admin-move-num">${i + 1}.</span>
      ${cols[m.fc]}${BOARD_ROWS - m.fr} → ${cols[m.tc]}${BOARD_ROWS - m.tr}
      <button class="admin-move-del" onclick="adminDeleteMove(${i})">✕</button>
    </li>`
  ).join('');
}

function adminDeleteMove(idx) {
  adminState.moves.splice(idx, 1);
  updateAdminMoveList();
}

function adminClearBoard() {
  if (!confirm('Taxtani tozalash?')) return;
  adminInitBoard();
  drawAdminBoard();
}

function adminUndoMove() {
  if (!adminState.moves.length) return;
  const last = adminState.moves.pop();
  // Ko'chirishni qaytarish
  adminState.board[last.fr][last.fc] = { ...adminState.board[last.tr][last.tc] };
  adminState.board[last.tr][last.tc]  = null;
  drawAdminBoard();
  updateAdminMoveList();
}

// ── SAQLASH ───────────────────────────────────────────────────
async function adminSavePuzzle() {
  if (!adminState.isAdmin) return;

  // Saqlash uchun BOSHLANG'ICH pozitsiyani ishlatamiz (hamlalar qo'llanilmasdan oldingi holat).
  // Agar admin hali 'solution' rejimiga umuman o'tmagan bo'lsa (masalan hamma narsani
  // 'place' rejimida qilib, keyin to'g'ridan-to'g'ri saqlamoqchi bo'lsa), joriy boardni ishlatamiz.
  const boardToSave = adminState.initialBoard || adminState.board;

  // Validatsiya
  const whiteKing = boardToSave.flat().find(p => p?.type === PIECE.KING && p?.color === COLOR.WHITE);
  const blackKing = boardToSave.flat().find(p => p?.type === PIECE.KING && p?.color === COLOR.BLACK);

  if (!whiteKing || !blackKing) {
    showAdminToast('❌ Taxta ikki tomondan ham Shoh bo\'lishi kerak!', 'error');
    return;
  }
  if (!adminState.moves.length) {
    showAdminToast('❌ Kamida 1 ta yechim hamlasi kiriting!', 'error');
    return;
  }

  const difficulty = document.getElementById('admin-difficulty')?.value || 'easy';
  const theme      = document.getElementById('admin-theme')?.value      || 'tactics';
  const eloVal     = parseInt(document.getElementById('admin-elo')?.value) || 1000;

  const saveBtn = document.getElementById('admin-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saqlanmoqda...'; }

  try {
    const { error } = await getSb().from('puzzles').insert({
      board_json:   JSON.stringify(boardToSave),
      moves_json:   JSON.stringify(adminState.moves),
      current_turn: adminState.currentTurn,
      difficulty,
      theme,
      elo:          eloVal,
    });

    if (error) throw error;

    showAdminToast('✅ Puzzle saqlandi!', 'success');
    adminInitBoard();
    drawAdminBoard();
    await loadAdminPuzzleList();
  } catch (e) {
    showAdminToast('❌ Xato: ' + e.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Saqlash'; }
  }
}

// ── PUZZLE RO'YXATI ───────────────────────────────────────────
async function loadAdminPuzzleList() {
  const tbody = document.getElementById('admin-puzzle-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="admin-lb-loading">Yuklanmoqda...</td></tr>';

  try {
    const { data, error } = await getSb()
      .from('puzzles')
      .select('id, puzzle_number, difficulty, theme, elo, current_turn, board_json, moves_json')
      .order('puzzle_number', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-lb-loading">Hali puzzle yo\'q</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => `
      <tr>
        <td class="ap-num">#${p.puzzle_number || '—'}</td>
        <td><span class="puzzle-badge diff-${p.difficulty}">${p.difficulty}</span></td>
        <td>${p.theme || '—'}</td>
        <td>${p.elo || '—'}</td>
        <td>${p.current_turn === 'white' ? '⬜ Oq' : '⬛ Qora'}</td>
        <td class="ap-actions">
          <button class="admin-clone-btn" title="Nusxa olish"
            onclick="adminClonePuzzle('${p.id}')">⧉</button>
          <button class="admin-del-btn" title="O'chirish"
            onclick="adminDeletePuzzle('${p.id}')">🗑</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-lb-loading">Xato: ${e.message}</td></tr>`;
  }
}

async function adminDeletePuzzle(id) {
  if (!confirm('Bu puzzle o\'chirilsinmi?')) return;
  try {
    const { error } = await getSb().from('puzzles').delete().eq('id', id);
    if (error) throw error;
    showAdminToast('🗑 O\'chirildi', 'success');
    await loadAdminPuzzleList();
  } catch (e) {
    showAdminToast('❌ ' + e.message, 'error');
  }
}

async function adminClonePuzzle(id) {
  // Ro'yxatdan to'liq ma'lumotni olamiz (allaqachon yuklangan, lekin xavfsiz qayta so'raymiz)
  try {
    const { data, error } = await getSb()
      .from('puzzles')
      .select('board_json, moves_json, current_turn, difficulty, theme, elo')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Taxtani nusxa puzzle pozitsiyasidan tiklaymiz
    adminState.board        = JSON.parse(data.board_json);
    adminState.initialBoard = JSON.parse(data.board_json); // boshlang'ich holat ham bir xil
    adminState.moves        = JSON.parse(data.moves_json);
    adminState.currentTurn  = data.current_turn || 'white';
    adminState.moveFrom     = null;
    adminState.mode         = 'place'; // place rejimidan boshlaymiz — kerak bo'lsa o'zgartiradi

    // Meta maydonlarni to'ldirамiz
    const diffEl = document.getElementById('admin-difficulty');
    const themeEl = document.getElementById('admin-theme');
    const eloEl   = document.getElementById('admin-elo');
    const turnEl  = document.getElementById('admin-turn-sel');
    if (diffEl)  diffEl.value  = data.difficulty  || 'easy';
    if (themeEl) themeEl.value = data.theme        || 'tactics';
    if (eloEl)   eloEl.value   = data.elo          || 1000;
    if (turnEl)  turnEl.value  = data.current_turn || 'white';

    // Hamlalar ro'yxatini yangilaymiz
    updateAdminMoveList();

    // Taxtani qayta chizamiz
    drawAdminBoard();

    // Sahifani yuqoriga — foydalanuvchi taxtani ko'rsin
    document.getElementById('admin-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showAdminToast('⧉ Nusxa olindi — o\'zgartirib saqlang!', 'success');
  } catch (e) {
    showAdminToast('❌ Nusxa olishda xato: ' + e.message, 'error');
  }
}

// ── TOAST ─────────────────────────────────────────────────────
function showAdminToast(msg, type = 'info') {
  let el = document.getElementById('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent  = msg;
  el.className    = `admin-toast admin-toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── DONNA PALITRASI YARATISH ──────────────────────────────────
function buildAdminPalette() {
  const container = document.getElementById('admin-palette');
  if (!container) return;

  const pieces = [
    { type: PIECE.KING,         label: '♔', name: 'Shoh' },
    { type: PIECE.FERZ,         label: '♕', name: 'Ferz' },
    { type: PIECE.WAZIR,        label: '◆', name: 'Vazir' },
    { type: PIECE.ROOK,         label: '♖', name: 'Rook' },
    { type: PIECE.KNIGHT,       label: '♘', name: 'Ot' },
    { type: PIECE.PICKET,       label: '⚑', name: 'Picket' },
    { type: PIECE.ELEPHANT,     label: '🐘', name: 'Fil' },
    { type: PIECE.CAMEL,        label: '🐪', name: 'Tuya' },
    { type: PIECE.GIRAFFE,      label: '🦒', name: 'Jirafa' },
    { type: PIECE.DABBABA,      label: '⛭', name: 'Dabbaba' },
    { type: PIECE.PAWN_PAWN,     label: '♟', name: 'Piyoda' },
    { type: PIECE.PAWN_DABBABA,  label: '♟⛭', name: "P. Dabbaba" },
    { type: PIECE.PAWN_CAMEL,    label: '♟🐪', name: "P. Tuya" },
    { type: PIECE.PAWN_ELEPHANT, label: '♟🐘', name: "P. Fil" },
    { type: PIECE.PAWN_FERZ,     label: '♟♕', name: "P. Ferz" },
    { type: PIECE.PAWN_KING,     label: '♟♔', name: "P. Shoh" },
    { type: PIECE.PAWN_WAZIR,    label: '♟◆', name: "P. Vazir" },
    { type: PIECE.PAWN_GIRAFFE,  label: '♟🦒', name: "P. Jirafa" },
    { type: PIECE.PAWN_PICKET,   label: '♟⚑', name: "P. Picket" },
    { type: PIECE.PAWN_KNIGHT,   label: '♟♘', name: "P. Ot" },
    { type: PIECE.PAWN_ROOK,     label: '♟♖', name: "P. Rook" },
  ];

  const html = `
    <div class="apc-section">
      <div class="apc-label">⬜ Oq donalar</div>
      <div class="apc-grid">
        ${pieces.map(p => `
          <button class="apc-btn" data-key="${COLOR.WHITE}-${p.type}"
            title="${p.name}"
            onclick="selectAdminPiece('${COLOR.WHITE}','${p.type}')">
            <span class="apc-icon">${p.label}</span>
            <span class="apc-name">${p.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="apc-section">
      <div class="apc-label">⬛ Qora donalar</div>
      <div class="apc-grid">
        ${pieces.map(p => `
          <button class="apc-btn apc-black" data-key="${COLOR.BLACK}-${p.type}"
            title="${p.name}"
            onclick="selectAdminPiece('${COLOR.BLACK}','${p.type}')">
            <span class="apc-icon">${p.label}</span>
            <span class="apc-name">${p.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <button class="btn btn-ghost apc-deselect" onclick="deselectAdminPiece()">
      ✖ Tanlovni bekor qilish
    </button>
  `;
  container.innerHTML = html;
}

// ============================================================
//  ANALYTICS
// ============================================================

let _analyticsUsers = []; // qidiruv uchun cache

function switchAdminTab(tab) {
  document.getElementById('admin-section-puzzles')
    ?.classList.toggle('hidden', tab !== 'puzzles');
  document.getElementById('admin-section-analytics')
    ?.classList.toggle('hidden', tab !== 'analytics');
  document.getElementById('admin-tab-puzzles')
    ?.classList.toggle('active', tab === 'puzzles');
  document.getElementById('admin-tab-analytics')
    ?.classList.toggle('active', tab === 'analytics');

  if (tab === 'analytics') loadAnalytics();
}

async function loadAnalytics() {
  await Promise.all([
    loadAnalyticsCards(),
    loadAnalyticsUsers(),
    loadAnalyticsCharts(),
  ]);
}

// ── KARTALAR ──────────────────────────────────────────────────
async function loadAnalyticsCards() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Jami foydalanuvchi
    const { count: totalUsers } = await getSb()
      .from('profiles').select('*', { count: 'exact', head: true });

    // Bugun qo'shilgan
    const { count: todayUsers } = await getSb()
      .from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00Z');

    // Jami o'yinlar
    const { count: totalGames } = await getSb()
      .from('games').select('*', { count: 'exact', head: true });

    // Jami puzzle yechilgan (barcha foydalanuvchilar puzzle_solved yig'indisi)
    const { data: pData } = await getSb()
      .from('profiles').select('puzzle_solved');
    const totalPuzzles = (pData || []).reduce((s, r) => s + (r.puzzle_solved || 0), 0);

    document.getElementById('an-total-users').textContent  = totalUsers  ?? '—';
    document.getElementById('an-today-users').textContent  = todayUsers  ?? '—';
    document.getElementById('an-total-games').textContent  = totalGames  ?? '—';
    document.getElementById('an-total-puzzles').textContent = totalPuzzles;
  } catch (e) {
    console.warn('Analytics cards xato:', e.message);
  }
}

// ── FOYDALANUVCHILAR JADVALI ──────────────────────────────────
async function loadAnalyticsUsers() {
  const tbody = document.getElementById('an-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="admin-lb-loading">Yuklanmoqda...</td></tr>';

  try {
    const { data, error } = await getSb()
      .from('profiles')
      .select('id, nickname, elo, puzzle_elo, games_played, puzzle_solved, wins, losses, draws, created_at, is_admin, is_banned')
      .order('created_at', { ascending: false });

    if (error) throw error;
    _analyticsUsers = data || [];
    renderAnalyticsUsers(_analyticsUsers);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="admin-lb-loading">Xato: ${e.message}</td></tr>`;
  }
}

function renderAnalyticsUsers(users) {
  const tbody = document.getElementById('an-users-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="admin-lb-loading">Foydalanuvchi yo\'q</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((u, i) => {
    const date       = u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : '—';
    const adminBadge = u.is_admin  ? '<span class="an-admin-badge">admin</span>' : '';
    const banBadge   = u.is_banned ? '<span class="an-banned-badge">banned</span>' : '';
    const banBtn     = u.is_admin  ? '' : u.is_banned
      ? `<button class="admin-ban-btn unban" onclick="adminToggleBan('${u.id}', false, '${u.nickname}')">✓ Unban</button>`
      : `<button class="admin-ban-btn"       onclick="adminToggleBan('${u.id}', true,  '${u.nickname}')">⛔ Ban</button>`;

    // Email — auth.users dan olinmaydi client-side da, shuning uchun profiles da yo'q bo'lsa yashiramiz
    const emailRow = u.email
      ? `<div class="an-email">${u.email}</div>`
      : '';

    return `<tr class="${u.is_banned ? 'an-row-banned' : ''}">
      <td class="ap-num">${i + 1}</td>
      <td>
        <div class="an-nick">${u.nickname || '—'}${adminBadge}${banBadge}</div>
        ${emailRow}
      </td>
      <td>${u.elo || 1200}</td>
      <td>${u.puzzle_elo || 1000}</td>
      <td>${u.games_played || 0}</td>
      <td>${u.puzzle_solved || 0}</td>
      <td class="an-wld">${u.wins||0}/${u.losses||0}/${u.draws||0}</td>
      <td class="an-date">${date}</td>
      <td class="ap-actions">
        ${banBtn}
        <button class="admin-del-btn" title="O'chirish"
          onclick="adminDeleteUser('${u.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function filterAnalyticsUsers(query) {
  const q = query.toLowerCase().trim();
  if (!q) { renderAnalyticsUsers(_analyticsUsers); return; }
  renderAnalyticsUsers(_analyticsUsers.filter(u =>
    (u.nickname || '').toLowerCase().includes(q)
  ));
}

async function adminDeleteUser(id) {
  const u = _analyticsUsers.find(u => u.id === id);
  const nickname = u?.nickname || id;

  if (!confirm(`"${nickname}" foydalanuvchisini o'chirishni tasdiqlaysizmi?`)) return;
  try {
    const { error } = await getSb()
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showAdminToast(`🗑 ${nickname} profili o'chirildi`, 'success');
    _analyticsUsers = _analyticsUsers.filter(u => u.id !== id);
    renderAnalyticsUsers(_analyticsUsers);
  } catch (e) {
    showAdminToast('❌ Xato: ' + e.message, 'error');
  }
}

async function adminToggleBan(id, ban, nickname) {
  const action = ban ? 'ban' : 'unban';
  if (!confirm(`"${nickname}" ni ${action} qilasizmi?`)) return;
  try {
    const { error } = await getSb()
      .from('profiles')
      .update({ is_banned: ban })
      .eq('id', id);
    if (error) throw error;

    // Lokal cache ni yangilaymiz
    const u = _analyticsUsers.find(u => u.id === id);
    if (u) u.is_banned = ban;
    renderAnalyticsUsers(_analyticsUsers);

    showAdminToast(
      ban ? `⛔ ${nickname} ban qilindi` : `✓ ${nickname} unban qilindi`,
      'success'
    );
  } catch (e) {
    showAdminToast('❌ Xato: ' + e.message, 'error');
  }
}

// ── GRAFIKLAR ─────────────────────────────────────────────────
async function loadAnalyticsCharts() {
  await Promise.all([
    drawUsersGrowthChart(),
    drawActivityChart(),
  ]);
}

async function drawUsersGrowthChart() {
  const canvas = document.getElementById('an-users-chart');
  if (!canvas) return;

  try {
    // So'nggi 30 kun sanalarini tayyorlaymiz
    const days = getLast30Days();

    const { data } = await getSb()
      .from('profiles')
      .select('created_at')
      .gte('created_at', days[0] + 'T00:00:00Z');

    // Har kun uchun necha kishi qo'shilganini hisoblaymiz
    const counts = {};
    days.forEach(d => counts[d] = 0);
    (data || []).forEach(r => {
      const d = r.created_at?.slice(0, 10);
      if (d && counts[d] !== undefined) counts[d]++;
    });

    drawBarChart(canvas, {
      labels: days.map(d => d.slice(5)), // MM-DD
      values: days.map(d => counts[d]),
      color:  '#C9A84C',
      label:  'Yangi foydalanuvchi',
    });
  } catch (e) {
    console.warn('Users chart xato:', e.message);
  }
}

async function drawActivityChart() {
  const canvas = document.getElementById('an-activity-chart');
  if (!canvas) return;

  try {
    const days = getLast14Days();
    const from = days[0] + 'T00:00:00Z';

    // Parallel so'rovlar
    const [puzzleRes, gamesRes] = await Promise.all([
      getSb().from('puzzle_daily').select('date, count').gte('date', days[0]),
      getSb().from('games').select('created_at').gte('created_at', from),
    ]);

    // Puzzle kunlik yig'indisi
    const puzzleCounts = {};
    days.forEach(d => puzzleCounts[d] = 0);
    (puzzleRes.data || []).forEach(r => {
      if (r.date && puzzleCounts[r.date] !== undefined)
        puzzleCounts[r.date] += r.count || 0;
    });

    // O'yinlar kunlik soni
    const gameCounts = {};
    days.forEach(d => gameCounts[d] = 0);
    (gamesRes.data || []).forEach(r => {
      const d = r.created_at?.slice(0, 10);
      if (d && gameCounts[d] !== undefined) gameCounts[d]++;
    });

    drawDoubleBarChart(canvas, {
      labels:  days.map(d => d.slice(5)),
      values1: days.map(d => puzzleCounts[d]),
      values2: days.map(d => gameCounts[d]),
      color1:  '#C9A84C',
      color2:  '#6aabff',
      label1:  'Puzzle',
      label2:  'O\'yin',
    });
  } catch (e) {
    console.warn('Activity chart xato:', e.message);
  }
}

// ── CHART HELPER FUNKSIYALAR ──────────────────────────────────
function getLast30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    return d.toISOString().slice(0, 10);
  });
}

function getLast14Days() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return d.toISOString().slice(0, 10);
  });
}

function drawBarChart(canvas, { labels, values, color, label }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 600;
  const H = canvas.height = canvas.offsetHeight || 180;
  const pad = { top: 20, right: 16, bottom: 32, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;
  const max = Math.max(...values, 1);

  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // Fon
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0, 0, W, H);

  // Grid chiziqlar
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    // Y label
    ctx.fillStyle = 'rgba(200,168,76,0.6)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((max / 4) * i), pad.left - 4, y + 4);
  }

  // Barlar
  const barW = Math.max(2, chartW / labels.length - 2);
  values.forEach((v, i) => {
    const bH = (v / max) * chartH;
    const x  = pad.left + (chartW / labels.length) * i + (chartW / labels.length - barW) / 2;
    const y  = pad.top + chartH - bH;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bH, [3, 3, 0, 0]);
    ctx.fill();

    // X label (har 5 tadan)
    if (i % 5 === 0 || i === labels.length - 1) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#C9A84C';
      ctx.font = '9px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, H - pad.bottom + 12);
    }
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDoubleBarChart(canvas, { labels, values1, values2, color1, color2, label1, label2 }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 600;
  const H = canvas.height = canvas.offsetHeight || 180;
  const pad = { top: 28, right: 16, bottom: 32, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;
  const max = Math.max(...values1, ...values2, 1);

  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,168,76,0.6)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((max / 4) * i), pad.left - 4, y + 4);
  }

  // Legend
  const legendY = pad.top - 14;
  ctx.fillStyle = color1; ctx.fillRect(pad.left, legendY, 10, 8);
  ctx.fillStyle = 'rgba(200,200,200,0.7)'; ctx.font = '10px Inter'; ctx.textAlign = 'left';
  ctx.fillText(label1, pad.left + 14, legendY + 7);
  ctx.fillStyle = color2; ctx.fillRect(pad.left + 80, legendY, 10, 8);
  ctx.fillStyle = 'rgba(200,200,200,0.7)';
  ctx.fillText(label2, pad.left + 94, legendY + 7);

  // Juft barlar
  const groupW = chartW / labels.length;
  const barW   = Math.max(2, groupW / 2 - 2);

  labels.forEach((lbl, i) => {
    const x1 = pad.left + groupW * i + (groupW - barW * 2 - 2) / 2;
    const x2 = x1 + barW + 2;

    const bH1 = (values1[i] / max) * chartH;
    const bH2 = (values2[i] / max) * chartH;

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color1;
    ctx.beginPath();
    ctx.roundRect(x1, pad.top + chartH - bH1, barW, bH1, [3, 3, 0, 0]);
    ctx.fill();

    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.roundRect(x2, pad.top + chartH - bH2, barW, bH2, [3, 3, 0, 0]);
    ctx.fill();

    // X label (har 2 tadan)
    if (i % 2 === 0 || i === labels.length - 1) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#C9A84C';
      ctx.font = '9px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x1 + barW, H - pad.bottom + 12);
    }
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}