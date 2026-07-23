// ============================================================
//  AMIR TEMUR SHAXMATI — pieces.js  v5
//  Tarixiy Tamerlane Chess rekonstruksiyasi
//  10×11 taxta + 2 citadel = 112 katak
// ============================================================

// ── KONSTANTALAR ─────────────────────────────────────────────
const BOARD_COLS = 11;   // a..k  (11 ustun)
const BOARD_ROWS = 10;   // 1..10  (10 qator, row 0=yuqori=qator10, row 9=pastki=qator1)
const COLOR = { WHITE: 'white', BLACK: 'black' };

const PIECE = {
  // Qirollik
  KING:             'king',
  PRINCE:           'prince',
  ADV_KING:         'advKing',
  // Oddiy
  FERZ:             'ferz',
  WAZIR:            'wazir',
  GIRAFFE:          'giraffe',
  PICKET:           'picket',
  KNIGHT:           'knight',
  ROOK:             'rook',
  CAMEL:            'camel',
  ELEPHANT:         'elephant',
  DABBABA:          'dabbaba',
  // Piyodalar (11 xil)
  PAWN_PAWN:        'pawnPawn',
  PAWN_DABBABA:     'pawnDabbaba',
  PAWN_CAMEL:       'pawnCamel',
  PAWN_ELEPHANT:    'pawnElephant',
  PAWN_FERZ:        'pawnFerz',
  PAWN_KING:        'pawnKing',
  PAWN_WAZIR:       'pawnWazir',
  PAWN_GIRAFFE:     'pawnGiraffe',
  PAWN_PICKET:      'pawnPicket',
  PAWN_KNIGHT:      'pawnKnight',
  PAWN_ROOK:        'pawnRook',
};

// Qirollik donalari to'plami
const ROYAL_PIECES = new Set([PIECE.KING, PIECE.PRINCE, PIECE.ADV_KING]);

// Piyoda → aylanish donasi xaritasi
const PAWN_PROMOTES_TO = {
  pawnPawn:     null,           // Pawn of Pawns alohida qoida yo'q
  pawnDabbaba:  PIECE.DABBABA,
  pawnCamel:    PIECE.CAMEL,
  pawnElephant: PIECE.ELEPHANT,
  pawnFerz:     PIECE.FERZ,
  pawnKing:     PIECE.PRINCE,   // 1-marta → Prince
  pawnWazir:    PIECE.WAZIR,
  pawnGiraffe:  PIECE.GIRAFFE,
  pawnPicket:   PIECE.PICKET,
  pawnKnight:   PIECE.KNIGHT,
  pawnRook:     PIECE.ROOK,
};

// ── CITADEL ──────────────────────────────────────────────────
// White Citadel: a9 ning chap tomoni  → sentinel (row=2, col=-1)
// Black Citadel: k2 ning o'ng tomoni  → sentinel (row=9, col=11)
// (row 0 = yuqori = qator 11, row 10 = pastki = qator 1)
// Coord: qator 1 = index 10, qator 9 = index 2, qator 2 = index 9
const CITADEL = {
  WHITE: { r: 1,  c: -1  },   // a9 chap  (row1 = qator9, col-1 = taxta chap tashqarisida)
  BLACK: { r: 8,  c: 11  },   // k2 o'ng  (row8 = qator2, col11 = taxta o'ng tashqarisida)
};

function isCitadelCoord(r, c) {
  return (r === CITADEL.WHITE.r && c === CITADEL.WHITE.c) ||
         (r === CITADEL.BLACK.r && c === CITADEL.BLACK.c);
}

function citadelOwnerColor(r, c) {
  if (r === CITADEL.WHITE.r && c === CITADEL.WHITE.c) return COLOR.WHITE;
  if (r === CITADEL.BLACK.r && c === CITADEL.BLACK.c) return COLOR.BLACK;
  return null;
}

// Citadelning taxtadagi qo'shni katagi
function citadelNeighbor(r, c) {
  if (r === CITADEL.WHITE.r && c === CITADEL.WHITE.c) return { r: 1,  c: 0  }; // a9
  if (r === CITADEL.BLACK.r && c === CITADEL.BLACK.c) return { r: 8,  c: 10 }; // k2
  return null;
}

// ── DONA BELGILARI (canvas) ───────────────────────────────────
// Har bir dona uchun: unicode + qisqa nom + rang
const PIECE_DISPLAY = {
  king:        { sym: '♔', symB: '♚', label: 'Shoh',    short: 'Sh' },
  prince:      { sym: '♔', symB: '♚', label: 'Shahzoda', short: 'Pr' },
  advKing:     { sym: '♔', symB: '♚', label: "Qo'sh Sh", short: 'AK' },
  ferz:        { sym: '♕', symB: '♛', label: 'Ferz',    short: 'F'  },
  wazir:       { sym: '♗', symB: '♝', label: 'Vazir',   short: 'Vz' },
  giraffe:     { sym: '♕', symB: '♛', label: 'Giraf',   short: 'G'  },
  picket:      { sym: '♗', symB: '♝', label: 'Qorovchi',short: 'Pq' },
  knight:      { sym: '♘', symB: '♞', label: 'Ot',      short: ''   },
  rook:        { sym: '♖', symB: '♜', label: 'Tura',    short: ''   },
  camel:       { sym: '♘', symB: '♞', label: 'Teva',    short: 'T'  },
  elephant:    { sym: '♗', symB: '♝', label: 'Fil',     short: 'E'  },
  dabbaba:     { sym: '♖', symB: '♜', label: 'Dabbaba', short: 'D'  },
  // Piyodalar — hammalari ♙/♟ bilan, lekin harf bilan farqlanadi
  pawnPawn:    { sym: '♙', symB: '♟', label: 'Piyoda',  short: 'p'  },
  pawnDabbaba: { sym: '♙', symB: '♟', label: 'D-Piyoda',short: 'D'  },
  pawnCamel:   { sym: '♙', symB: '♟', label: 'T-Piyoda',short: 'T'  },
  pawnElephant:{ sym: '♙', symB: '♟', label: 'F-Piyoda',short: 'E'  },
  pawnFerz:    { sym: '♙', symB: '♟', label: 'Ferz-P',  short: 'F'  },
  pawnKing:    { sym: '♙', symB: '♟', label: 'Sh-Piyoda',short:'K'  },
  pawnWazir:   { sym: '♙', symB: '♟', label: 'Vz-Piyoda',short:'Vz' },
  pawnGiraffe: { sym: '♙', symB: '♟', label: 'G-Piyoda',short: 'G'  },
  pawnPicket:  { sym: '♙', symB: '♟', label: 'Pq-Piyoda',short:'Pq' },
  pawnKnight:  { sym: '♙', symB: '♟', label: 'Ot-Piyoda',short:'N'  },
  pawnRook:    { sym: '♙', symB: '♟', label: 'T-Piyoda', short:'R'  },
};

const PIECE_VALUE = {
  king:400, prince:350, advKing:350,
  ferz:150, wazir:100, giraffe:800, picket:350,
  knight:320, rook:500, camel:280, elephant:200, dabbaba:200,
  pawnPawn:80, pawnDabbaba:85, pawnCamel:85, pawnElephant:85,
  pawnFerz:90, pawnKing:100, pawnWazir:85, pawnGiraffe:90,
  pawnPicket:85, pawnKnight:85, pawnRook:90,
};

// ── YORDAMCHI ─────────────────────────────────────────────────
function inBounds(r, c) {
  return r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS;
}

function isPawn(type) {
  return type && type.startsWith('pawn');
}

function isRoyal(type) {
  return ROYAL_PIECES.has(type);
}

function opponent(color) {
  return color === COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
}

// ── BOSHLANG'ICH JOYLANISH ────────────────────────────────────
// row 10 = qator 1 (oq piyodalar), row 0 = qator 11 (qora piyodalar)
// Ustunlar: col 0=a, col 1=b, ... col 10=k
function createInitialBoard() {
  // BOARD_ROWS=10, BOARD_COLS=11
  // row 0 = qator 10 (yuqori, QORA orqa qator)
  // row 1 = qator 9  (QORA asosiy qator: Rook..Rook)
  // row 2 = qator 8  (QORA piyodalar)
  // row 7 = qator 3  (OQ piyodalar)
  // row 8 = qator 2  (OQ asosiy qator: Rook..Rook)
  // row 9 = qator 1  (pastki, OQ orqa qator)

  const B = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const p = (color, type) => ({ color, type, moved: false, promoteCount: 0 });

  // ── OQ — pastki ──────────────────────────────────────────────
  // row 9 = qator 1: Elephant - Camel - Dabbaba - Dabbaba - Camel - Elephant (bo'sh kataklar bilan)
  B[9][0]  = p(COLOR.WHITE, PIECE.ELEPHANT);
  // [9][1] empty
  B[9][2]  = p(COLOR.WHITE, PIECE.CAMEL);
  // [9][3] empty
  B[9][4]  = p(COLOR.WHITE, PIECE.DABBABA);
  // [9][5] empty
  B[9][6]  = p(COLOR.WHITE, PIECE.DABBABA);
  // [9][7] empty
  B[9][8]  = p(COLOR.WHITE, PIECE.CAMEL);
  // [9][9] empty
  B[9][10] = p(COLOR.WHITE, PIECE.ELEPHANT);

  // row 8 = qator 2: Rook-Knight-Picket-Giraffe-Ferz-King-Wazir-Giraffe-Picket-Knight-Rook
  B[8][0]  = p(COLOR.WHITE, PIECE.ROOK);
  B[8][1]  = p(COLOR.WHITE, PIECE.KNIGHT);
  B[8][2]  = p(COLOR.WHITE, PIECE.PICKET);
  B[8][3]  = p(COLOR.WHITE, PIECE.GIRAFFE);
  B[8][4]  = p(COLOR.WHITE, PIECE.FERZ);
  B[8][5]  = p(COLOR.WHITE, PIECE.KING);
  B[8][6]  = p(COLOR.WHITE, PIECE.WAZIR);
  B[8][7]  = p(COLOR.WHITE, PIECE.GIRAFFE);
  B[8][8]  = p(COLOR.WHITE, PIECE.PICKET);
  B[8][9]  = p(COLOR.WHITE, PIECE.KNIGHT);
  B[8][10] = p(COLOR.WHITE, PIECE.ROOK);

  // row 7 = qator 3: 11 piyoda
  B[7][0]  = p(COLOR.WHITE, PIECE.PAWN_PAWN);
  B[7][1]  = p(COLOR.WHITE, PIECE.PAWN_DABBABA);
  B[7][2]  = p(COLOR.WHITE, PIECE.PAWN_CAMEL);
  B[7][3]  = p(COLOR.WHITE, PIECE.PAWN_ELEPHANT);
  B[7][4]  = p(COLOR.WHITE, PIECE.PAWN_FERZ);
  B[7][5]  = p(COLOR.WHITE, PIECE.PAWN_KING);
  B[7][6]  = p(COLOR.WHITE, PIECE.PAWN_WAZIR);
  B[7][7]  = p(COLOR.WHITE, PIECE.PAWN_GIRAFFE);
  B[7][8]  = p(COLOR.WHITE, PIECE.PAWN_PICKET);
  B[7][9]  = p(COLOR.WHITE, PIECE.PAWN_KNIGHT);
  B[7][10] = p(COLOR.WHITE, PIECE.PAWN_ROOK);

  // ── QORA — yuqori ────────────────────────────────────────────
  // row 0 = qator 10: Elephant - Camel - Dabbaba - Dabbaba - Camel - Elephant
  B[0][0]  = p(COLOR.BLACK, PIECE.ELEPHANT);
  B[0][2]  = p(COLOR.BLACK, PIECE.CAMEL);
  B[0][4]  = p(COLOR.BLACK, PIECE.DABBABA);
  B[0][6]  = p(COLOR.BLACK, PIECE.DABBABA);
  B[0][8]  = p(COLOR.BLACK, PIECE.CAMEL);
  B[0][10] = p(COLOR.BLACK, PIECE.ELEPHANT);

  // row 1 = qator 9: Rook-Knight-Picket-Giraffe-Ferz-King-Wazir-Giraffe-Picket-Knight-Rook
  B[1][0]  = p(COLOR.BLACK, PIECE.ROOK);
  B[1][1]  = p(COLOR.BLACK, PIECE.KNIGHT);
  B[1][2]  = p(COLOR.BLACK, PIECE.PICKET);
  B[1][3]  = p(COLOR.BLACK, PIECE.GIRAFFE);
  B[1][4]  = p(COLOR.BLACK, PIECE.FERZ);
  B[1][5]  = p(COLOR.BLACK, PIECE.KING);
  B[1][6]  = p(COLOR.BLACK, PIECE.WAZIR);
  B[1][7]  = p(COLOR.BLACK, PIECE.GIRAFFE);
  B[1][8]  = p(COLOR.BLACK, PIECE.PICKET);
  B[1][9]  = p(COLOR.BLACK, PIECE.KNIGHT);
  B[1][10] = p(COLOR.BLACK, PIECE.ROOK);

  // row 2 = qator 8: 11 piyoda
  B[2][0]  = p(COLOR.BLACK, PIECE.PAWN_PAWN);
  B[2][1]  = p(COLOR.BLACK, PIECE.PAWN_DABBABA);
  B[2][2]  = p(COLOR.BLACK, PIECE.PAWN_CAMEL);
  B[2][3]  = p(COLOR.BLACK, PIECE.PAWN_ELEPHANT);
  B[2][4]  = p(COLOR.BLACK, PIECE.PAWN_FERZ);
  B[2][5]  = p(COLOR.BLACK, PIECE.PAWN_KING);
  B[2][6]  = p(COLOR.BLACK, PIECE.PAWN_WAZIR);
  B[2][7]  = p(COLOR.BLACK, PIECE.PAWN_GIRAFFE);
  B[2][8]  = p(COLOR.BLACK, PIECE.PAWN_PICKET);
  B[2][9]  = p(COLOR.BLACK, PIECE.PAWN_KNIGHT);
  B[2][10] = p(COLOR.BLACK, PIECE.PAWN_ROOK);

  return B;
}

// ── LEGAL MOVES ───────────────────────────────────────────────
function slideMoves(board, row, col, dirs) {
  const piece = board[row][col];
  const moves = [];
  for (const [dr, dc] of dirs) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      if (!board[r][c]) {
        moves.push([r, c]);
      } else {
        if (board[r][c].color !== piece.color) moves.push([r, c]);
        break;
      }
      r += dr; c += dc;
    }
  }
  return moves;
}

function jumpMoves(board, row, col, offsets) {
  const piece = board[row][col];
  const moves = [];
  for (const [dr, dc] of offsets) {
    const r = row + dr, c = col + dc;
    if (inBounds(r, c) && (!board[r][c] || board[r][c].color !== piece.color))
      moves.push([r, c]);
  }
  return moves;
}

// PIYODA yurishlari
function pawnMoves(board, row, col) {
  const piece = board[row][col];
  const dir   = piece.color === COLOR.WHITE ? -1 : 1;
  const moves = [];
  const nr = row + dir;
  if (inBounds(nr, col) && !board[nr][col]) moves.push([nr, col]);
  for (const dc of [-1, 1]) {
    if (inBounds(nr, col + dc) && board[nr][col + dc] &&
        board[nr][col + dc].color !== piece.color)
      moves.push([nr, col + dc]);
  }
  return moves;
  // Eslatma: ikki qadam yo'q (qoida bo'yicha)
}

// KING/PRINCE/ADV_KING: zamonaviy + citadelga kirish (rolga qarab cheklangan)
// Berilgan rang uchun "ranking" qirollik donani aniqlash: King > Prince > AdvKing
function rankingRoyalType(board, color) {
  const royals = findRoyals(board, color).map(r => r.type);
  if (royals.includes(PIECE.KING))     return PIECE.KING;
  if (royals.includes(PIECE.PRINCE))   return PIECE.PRINCE;
  if (royals.includes(PIECE.ADV_KING)) return PIECE.ADV_KING;
  return null;
}

function kingMoves(board, row, col) {
  const piece = board[row][col];
  const moves = jumpMoves(board, row, col,
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
  const ranking = rankingRoyalType(board, piece.color);
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const r = row + dr, c = col + dc;
    if (!isCitadelCoord(r, c)) continue;
    const citOwner = citadelOwnerColor(r, c);
    if (citOwner !== piece.color) {
      // Raqib citadeli — faqat eng yuqori darajadagi qirollik dona kira oladi
      if (piece.type === ranking) moves.push([r, c]);
    } else if (piece.type === PIECE.ADV_KING) {
      // O'z citadeli — faqat Sargardon shoh kira oladi (to'sish uchun)
      moves.push([r, c]);
    }
  }
  return moves;
}

// FERZ: 1 diagonal qadam
function ferzMoves(board, row, col) {
  return jumpMoves(board, row, col, [[-1,-1],[-1,1],[1,-1],[1,1]]);
}

// WAZIR: 1 gorizontal yoki vertikal
function wazirMoves(board, row, col) {
  return jumpMoves(board, row, col, [[-1,0],[1,0],[0,-1],[0,1]]);
}

// PICKET: diagonal slayder, kamida 2 katak
function picketMoves(board, row, col) {
  const piece = board[row][col];
  const moves = [];
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let r = row + dr, c = col + dc;
    let steps = 0;
    while (inBounds(r, c)) {
      steps++;
      if (!board[r][c]) {
        if (steps >= 2) moves.push([r, c]);
      } else {
        if (steps >= 2 && board[r][c].color !== piece.color) moves.push([r, c]);
        break;
      }
      r += dr; c += dc;
    }
  }
  return moves;
}

// GIRAFFE: 1 diagonal + min 3 perpendikulyar (to'siqsiz)
function giraffeMoves(board, row, col) {
  const piece = board[row][col];
  const moves = [];
  // 4 diagonal yo'nalish
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    const r1 = row + dr, c1 = col + dc;
    if (!inBounds(r1, c1)) continue;
    if (board[r1][c1]) continue; // diagonal katak band
    // To'g'ri perpendikulyarlar: agar dr=-1,dc=-1 → perp: (-1,1),(1,-1)
    const perpDirs = [];
    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
      perpDirs.push([dr, -dc], [-dr, dc]);
    }
    for (const [pr, pc] of perpDirs) {
      let r2 = r1, c2 = c1;
      let steps = 0;
      let blocked = false;
      while (true) {
        r2 += pr; c2 += pc;
        if (!inBounds(r2, c2)) break;
        steps++;
        if (board[r2][c2]) {
          if (steps >= 3 && board[r2][c2].color !== piece.color) moves.push([r2, c2]);
          blocked = true;
          break;
        }
        if (steps >= 3) moves.push([r2, c2]);
      }
    }
  }
  return moves;
}

// CAMEL: (3,1) sakrash
function camelMoves(board, row, col) {
  return jumpMoves(board, row, col,
    [[-3,-1],[-3,1],[-1,-3],[-1,3],[3,-1],[3,1],[1,-3],[1,3]]);
}

// ELEPHANT: aniq 2 diagonal sakrash (to'siqdan o'tadi)
function elephantMoves(board, row, col) {
  return jumpMoves(board, row, col, [[-2,-2],[-2,2],[2,-2],[2,2]]);
}

// DABBABA: aniq 2 gorizontal/vertikal sakrash
function dabbabaMoves(board, row, col) {
  return jumpMoves(board, row, col, [[-2,0],[2,0],[0,-2],[0,2]]);
}

// attack_squares() — bu dona qaysi kataklarni tahdid qiladi
function attackSquares(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  switch (piece.type) {
    case PIECE.KING:
    case PIECE.PRINCE:
    case PIECE.ADV_KING:
      return jumpMoves(board, row, col,
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
    case PIECE.FERZ:      return ferzMoves(board, row, col);
    case PIECE.WAZIR:     return wazirMoves(board, row, col);
    case PIECE.ROOK:      return slideMoves(board,row,col,[[-1,0],[1,0],[0,-1],[0,1]]);
    case PIECE.KNIGHT:    return jumpMoves(board,row,col,
                            [[-2,-1],[-2,1],[-1,-2],[-1,2],[2,-1],[2,1],[1,-2],[1,2]]);
    case PIECE.PICKET:    return picketMoves(board,row,col);
    case PIECE.GIRAFFE:   return giraffeMoves(board,row,col);
    case PIECE.CAMEL:     return camelMoves(board,row,col);
    case PIECE.ELEPHANT:  return elephantMoves(board,row,col);
    case PIECE.DABBABA:   return dabbabaMoves(board,row,col);
    default:
      if (isPawn(piece.type)) {
        const dir = piece.color === COLOR.WHITE ? -1 : 1;
        // Piyoda faqat diagonal oldinga hujum qiladi: (row+dir, col±1)
        return [col - 1, col + 1]
          .filter(c => inBounds(row + dir, c))
          .map(c => [row + dir, c]);
      }
      return [];
  }
}

// raw_moves — to'siq va check tekshiruvisiz
function rawMoves(board, row, col) {
  const p = board[row][col];
  if (!p) return [];
  switch (p.type) {
    case PIECE.KING:
    case PIECE.PRINCE:
    case PIECE.ADV_KING:   return kingMoves(board, row, col);
    case PIECE.FERZ:       return ferzMoves(board, row, col);
    case PIECE.WAZIR:      return wazirMoves(board, row, col);
    case PIECE.ROOK:       return slideMoves(board,row,col,[[-1,0],[1,0],[0,-1],[0,1]]);
    case PIECE.KNIGHT:     return jumpMoves(board,row,col,
                             [[-2,-1],[-2,1],[-1,-2],[-1,2],[2,-1],[2,1],[1,-2],[1,2]]);
    case PIECE.PICKET:     return picketMoves(board,row,col);
    case PIECE.GIRAFFE:    return giraffeMoves(board,row,col);
    case PIECE.CAMEL:      return camelMoves(board,row,col);
    case PIECE.ELEPHANT:   return elephantMoves(board,row,col);
    case PIECE.DABBABA:    return dabbabaMoves(board,row,col);
    default:
      if (isPawn(p.type)) return pawnMoves(board, row, col);
      return [];
  }
}

// ── SHOH TAHDIDI (citadel bilan) ─────────────────────────────
// Citadeldagi qirollik donasi uchun pos = { r, c } sentinel
function isSquareAttacked(board, r, c, byColor) {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const p = board[row][col];
      if (!p || p.color !== byColor) continue;
      const atk = attackSquares(board, row, col);
      if (atk.some(([ar,ac]) => ar === r && ac === c)) return true;
    }
  }
  return false;
}

// Rang uchun barcha qirollik donalarini topish
function findRoyals(board, color) {
  const royals = [];
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++) {
      const p = board[r][c];
      if (p && p.color === color && isRoyal(p.type))
        royals.push({ r, c, type: p.type });
    }
  return royals;
}

// Rang tahdid ostidami? (kamida 1 qirollik donasi hujum ostida)
function isInCheck(board, color) {
  const royals = findRoyals(board, color);
  if (royals.length === 0) return false; // citadelda yoki barchasi yo'q
  const enemy = opponent(color);
  return royals.some(({ r, c }) => isSquareAttacked(board, r, c, enemy));
}

// ── LEGAL MOVES (check filter) ───────────────────────────────
function getLegalMoves(board, row, col, gameCtx) {
  const piece = board[row][col];
  if (!piece) return [];

  const raw = rawMoves(board, row, col);
  const legal = [];

  for (const [tr, tc] of raw) {
    // Citadel filtri
    if (isCitadelCoord(tr, tc)) {
      if (!isRoyal(piece.type)) continue;       // Faqat qirollik donasi
      if (gameCtx) {
        const citOccupied = (tr === CITADEL.WHITE.r && tc === CITADEL.WHITE.c)
          ? gameCtx.whiteCitadel : gameCtx.blackCitadel;
        if (citOccupied !== null) continue;     // Band citadel
      }
    }

    // Simulyatsiya: bu yurish o'z qirollik donalarini tahdidga qo'ymasin
    const saved = board[tr][tc];
    board[tr][tc] = piece;
    board[row][col] = null;
    const inCh = isInCheck(board, piece.color);
    board[row][col] = piece;
    board[tr][tc] = saved;
    if (!inCh) legal.push([tr, tc]);
  }
  return legal;
}

// Rang uchun qonuniy yurish bormi?
function hasAnyLegalMove(board, color, gameCtx) {
  for (let r = 0; r < BOARD_ROWS; r++)
    for (let c = 0; c < BOARD_COLS; c++)
      if (board[r][c]?.color === color &&
          getLegalMoves(board, r, c, gameCtx).length > 0) return true;
  return false;
}

// ── O'YIN HOLATI ──────────────────────────────────────────────
function getGameState(board, turn, gameCtx) {
  // G'alaba: barcha qirollik donalari yo'q qilingan
  const royals = findRoyals(board, turn);
  // Citadeldagi qirollik donalarini ham hisobga olamiz
  const citadelRoyals = (gameCtx?.whiteCitadel && turn === COLOR.WHITE ? 1 : 0) +
                        (gameCtx?.blackCitadel && turn === COLOR.BLACK ? 1 : 0);
  if (royals.length + citadelRoyals === 0) return 'no_royals';

  const inCh  = isInCheck(board, turn);
  const hasMv = hasAnyLegalMove(board, turn, gameCtx);

  if (!hasMv && inCh)  return 'checkmate';
  if (!hasMv && !inCh) return 'stalemate_loss'; // Tamerlane qoidasi: pat = yutqazish
  if (inCh)            return 'check';
  return 'normal';
}

// ── PIYODA AYLANISHI ──────────────────────────────────────────
function promotionRow(color) {
  return color === COLOR.WHITE ? 0 : BOARD_ROWS - 1; // WHITE→row0(q10), BLACK→row9(q1)
}

function shouldPromote(piece, row) {
  if (!isPawn(piece.type)) return false;
  if (row !== promotionRow(piece.color)) return false;
  // pawnPawn — alohida maxsus logika orqali boshqariladi (game.js: handlePawnOfPawns)
  if (piece.type === PIECE.PAWN_PAWN) return false;
  return true;
}

function promotionLogic(piece) {
  const base = PAWN_PROMOTES_TO[piece.type];
  if (!base) return PIECE.FERZ; // fallback, ishlatilmasligi kerak
  if (base === PIECE.PRINCE) {
    // pawnKing: 1-marta → Prince, 2-marta → AdvKing
    if ((piece.promoteCount || 0) === 0) return PIECE.PRINCE;
    return PIECE.ADV_KING;
  }
  return base;
}

// Shoh piyodasining boshlang'ich joyi (pawnPawn 2-marta yetganda shu yerga ko'chadi)
function pawnKingStartSquare(color) {
  // Boshlang'ich joylanishda PAWN_KING col=5 da, row = piyodalar qatori
  return color === COLOR.WHITE ? { r: 7, c: 5 } : { r: 2, c: 5 };
}

// pawnPawn maxsus holatini aniqlash: u oxiriga yetganmi (1-bosqich), 2-bosqichda yo'lda?
function pawnPawnStage(piece) {
  return piece.promoteCount || 0; // 0 = hali yetmagan, 1 = 1-marta yetgan (to'siq), 2 = 2-marta yetgan (yo'lda Sh-joyga), 3 = promote
}

// ── TAXTA NUSXASI ─────────────────────────────────────────────
function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// ── DONA MA'LUMOTI (popup uchun) ──────────────────────────────
function getPieceInfo(type, lang) {
  const db = {
    uz: {
      king:        { name: 'Shoh',         desc: 'Har tomonga 1 qadam. O\'z donasi bilan joy almashtirishi mumkin.' },
      prince:      { name: 'Shahzoda',     desc: 'Shoh kabi yuradi. Shoh-Piyodaning 1-promotion.' },
      advKing:     { name: "Qo'shimcha Sh",desc: "Shoh kabi yuradi. Shoh-Piyodaning 2-promotion." },
      ferz:        { name: 'Ferz',         desc: 'Faqat 1 diagonal qadam. Klassik Shatranj Ferzi.' },
      wazir:       { name: 'Vazir',        desc: '1 gorizontal yoki vertikal qadam.' },
      giraffe:     { name: 'Giraf G',      desc: '1 diagonal, so\'ng kamida 3 perpendikulyar. To\'siq bo\'lsa o\'ta olmaydi.' },
      picket:      { name: 'Qorovchi Pq',  desc: 'Diagonal slayder, kamida 2 katak.' },
      knight:      { name: 'Ot',           desc: 'L-shakl (2+1). To\'siqdan sakrab o\'tadi.' },
      rook:        { name: 'Tura',         desc: 'Cheksiz gorizontal va vertikal.' },
      camel:       { name: 'Teva T',       desc: '(3+1) sakrash. Katta Ot.' },
      elephant:    { name: 'Fil E',        desc: 'Aniq 2 diagonal sakrash. To\'siqdan o\'tadi.' },
      dabbaba:     { name: 'Dabbaba D',    desc: 'Aniq 2 gorizontal/vertikal sakrash. To\'siqdan o\'tadi.' },
      pawnPawn:    { name: 'Piyoda',       desc: 'Oldinga 1. Diagonal uradi.' },
      pawnDabbaba: { name: 'D-Piyoda',     desc: '→ Dabbaba. Oldinga 1. Diagonal uradi.' },
      pawnCamel:   { name: 'T-Piyoda',     desc: '→ Teva. Oldinga 1. Diagonal uradi.' },
      pawnElephant:{ name: 'F-Piyoda',     desc: '→ Fil. Oldinga 1. Diagonal uradi.' },
      pawnFerz:    { name: 'Ferz-Piyoda',  desc: '→ Ferz. Oldinga 1. Diagonal uradi.' },
      pawnKing:    { name: 'Sh-Piyoda',    desc: '→ Shahzoda → Qo\'sh Shoh!' },
      pawnWazir:   { name: 'Vz-Piyoda',    desc: '→ Vazir. Oldinga 1. Diagonal uradi.' },
      pawnGiraffe: { name: 'G-Piyoda',     desc: '→ Giraf. Oldinga 1. Diagonal uradi.' },
      pawnPicket:  { name: 'Pq-Piyoda',    desc: '→ Qorovchi. Oldinga 1. Diagonal uradi.' },
      pawnKnight:  { name: 'Ot-Piyoda',    desc: '→ Ot. Oldinga 1. Diagonal uradi.' },
      pawnRook:    { name: 'Tura-Piyoda',  desc: '→ Tura. Oldinga 1. Diagonal uradi.' },
    },
    en: {
      king:        { name: 'King',          desc: '1 step any direction. Can swap with own piece once.' },
      prince:      { name: 'Prince',        desc: 'Moves like King. 1st promotion of Pawn of King.' },
      advKing:     { name: 'Adv. King',     desc: 'Moves like King. 2nd promotion of Pawn of King.' },
      ferz:        { name: 'Ferz',          desc: '1 diagonal step. Classic Shatranj Ferz.' },
      wazir:       { name: 'Wazir',         desc: '1 orthogonal step.' },
      giraffe:     { name: 'Giraffe G',     desc: '1 diagonal then ≥3 perpendicular. Blocked by pieces.' },
      picket:      { name: 'Picket Pq',     desc: 'Diagonal slider, minimum 2 squares.' },
      knight:      { name: 'Knight',        desc: 'L-shape (2+1). Jumps over pieces.' },
      rook:        { name: 'Rook',          desc: 'Unlimited horizontal/vertical.' },
      camel:       { name: 'Camel T',       desc: '(3+1) leap. Big Knight.' },
      elephant:    { name: 'Elephant E',    desc: 'Exactly 2 diagonal leap. Jumps over.' },
      dabbaba:     { name: 'Dabbaba D',     desc: 'Exactly 2 orthogonal leap. Jumps over.' },
      pawnPawn:    { name: 'Pawn',          desc: 'Forward 1. Captures diagonally.' },
      pawnDabbaba: { name: 'D-Pawn',        desc: '→ Dabbaba on promotion.' },
      pawnCamel:   { name: 'C-Pawn',        desc: '→ Camel on promotion.' },
      pawnElephant:{ name: 'E-Pawn',        desc: '→ Elephant on promotion.' },
      pawnFerz:    { name: 'F-Pawn',        desc: '→ Ferz on promotion.' },
      pawnKing:    { name: 'K-Pawn',        desc: '→ Prince → Adv. King!' },
      pawnWazir:   { name: 'W-Pawn',        desc: '→ Wazir on promotion.' },
      pawnGiraffe: { name: 'G-Pawn',        desc: '→ Giraffe on promotion.' },
      pawnPicket:  { name: 'P-Pawn',        desc: '→ Picket on promotion.' },
      pawnKnight:  { name: 'N-Pawn',        desc: '→ Knight on promotion.' },
      pawnRook:    { name: 'R-Pawn',        desc: '→ Rook on promotion.' },
    },
  };
  const lang_db = db[lang] || db['en'];
  return lang_db[type] || { name: type, desc: '' };
}