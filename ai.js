// ============================================================
//  AMIR TEMUR SHAXMATI — ai.js  v5
// ============================================================

// ── POZITSIYA BONUSLARI ───────────────────────────────────────
function getPST(type, color) {
  // Markazga yaqinlash uchun universal hisob
  const centerBonus = (r, c) => {
    const dr = Math.abs(r - 5), dc = Math.abs(c - 5);
    return Math.max(0, 10 - (dr + dc) * 1.5);
  };
  return centerBonus;
}

function evaluateBoard(board, gameCtx) {
  let materialScore = 0;
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val  = PIECE_VALUE[p.type] || 50;
      const pstFn = getPST(p.type, p.color);
      const pst  = pstFn ? pstFn(p.color===COLOR.WHITE ? BOARD_ROWS-1-r : r, c) : 0;
      materialScore += p.color===COLOR.WHITE ? (val+pst) : -(val+pst);
    }
  }

  let score = materialScore;

  // Citadel orqali durrang — faqat yutqazayotgan tomon uchun foydali.
  // Agar materialScore manfiy (oq yutqazyapti) va oq citadelda bo'lsa — bu yaxshi qochish (durrang),
  // shuning uchun bonusni materialdagi kamchilik bilan bog'liq qilamiz.
  const DRAW_VALUE = 0; // durrang umumiy qiymati (neytral)
  if (gameCtx?.whiteCitadel) {
    // Oq durrang oladi: agar oq yutqazayotgan bo'lsa (materialScore<0), durrang foydali (DRAW_VALUE > materialScore)
    // agar oq yutib borayotgan bo'lsa (materialScore>0), durrang zararli (DRAW_VALUE < materialScore)
    score = DRAW_VALUE;
  }
  if (gameCtx?.blackCitadel) {
    score = DRAW_VALUE;
  }

  return score;
}

function getAllMoves(board, color, gameCtx) {
  const moves = [];
  for (let r=0; r<BOARD_ROWS; r++)
    for (let c=0; c<BOARD_COLS; c++) {
      if (board[r][c]?.color===color) {
        const legal = getLegalMoves(board, r, c, gameCtx);
        legal.forEach(([tr,tc])=>moves.push({fr:r,fc:c,tr,tc}));
      }
    }
  return moves;
}

function orderMoves(board, moves) {
  return moves.sort((a,b)=>{
    const vb = board[b.tr]?.[b.tc] ? (PIECE_VALUE[board[b.tr][b.tc].type]||0) : 0;
    const va = board[a.tr]?.[a.tc] ? (PIECE_VALUE[board[a.tr][a.tc].type]||0) : 0;
    return vb-va;
  });
}

function minimax(board, depth, alpha, beta, isMax, gameCtx) {
  const turn = isMax ? COLOR.WHITE : COLOR.BLACK;
  const state = getGameState(board, turn, gameCtx);
  // checkmate va stalemate_loss — ikkisi ham navbatdagi tomon yutqazadi
  if (state==='checkmate' || state==='stalemate_loss')
    return isMax ? -90000 : 90000;
  if (state==='no_royals') return isMax ? -90000 : 90000;
  if (depth===0) return evaluateBoard(board, gameCtx);

  const moves = orderMoves(board, getAllMoves(board, turn, gameCtx));
  if (moves.length===0) return evaluateBoard(board, gameCtx);

  if (isMax) {
    let best=-Infinity;
    for (const m of moves) {
      const saved=board[m.tr]?.[m.tc];
      const piece=board[m.fr][m.fc];
      if (board[m.tr]) board[m.tr][m.tc]=piece;
      board[m.fr][m.fc]=null;
      best=Math.max(best, minimax(board,depth-1,alpha,beta,false,gameCtx));
      alpha=Math.max(alpha,best);
      board[m.fr][m.fc]=piece;
      if (board[m.tr]) board[m.tr][m.tc]=saved;
      if (beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for (const m of moves) {
      const saved=board[m.tr]?.[m.tc];
      const piece=board[m.fr][m.fc];
      if (board[m.tr]) board[m.tr][m.tc]=piece;
      board[m.fr][m.fc]=null;
      best=Math.min(best, minimax(board,depth-1,alpha,beta,true,gameCtx));
      beta=Math.min(beta,best);
      board[m.fr][m.fc]=piece;
      if (board[m.tr]) board[m.tr][m.tc]=saved;
      if (beta<=alpha) break;
    }
    return best;
  }
}

const DIFF_DEPTH    = { easy: 1, medium: 3, hard: 4 };
const DIFF_TIME_MS  = { easy: 300, medium: 800, hard: 4000 }; // hard uchun ko'proq vaqt = iterative deepening chuqurroq ketadi
const DIFF_RANDOM   = { easy: 0.4, medium: 0.05, hard: 0 };

// Iterative deepening + vaqt chegarasi — Hard darajada AI imkon qadar chuqur qaraydi
function getBestMoveIterative(board, color, difficulty, gameCtx) {
  const maxDepth = DIFF_DEPTH[difficulty] || 2;
  const timeLimit = DIFF_TIME_MS[difficulty] || 500;
  const startTime = Date.now();

  const moves = orderMoves(board, getAllMoves(board, color, gameCtx));
  if (!moves.length) return null;

  const randomChance = DIFF_RANDOM[difficulty] || 0;
  if (randomChance > 0 && Math.random() < randomChance)
    return moves[Math.floor(Math.random() * moves.length)];

  const isMax = color === COLOR.WHITE;
  let bestMove = moves[0];
  let bestOverall = isMax ? -Infinity : Infinity;

  // Har bir chuqurlik darajasida qayta hisoblash (oldingi natijadan move ordering uchun foydalanish mumkin)
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startTime > timeLimit) break;

    let best = isMax ? -Infinity : Infinity;
    let currentBestMove = moves[0];
    let timeUp = false;

    for (const m of moves) {
      if (Date.now() - startTime > timeLimit) { timeUp = true; break; }

      const saved = board[m.tr]?.[m.tc];
      const piece = board[m.fr][m.fc];
      if (board[m.tr]) board[m.tr][m.tc] = piece;
      board[m.fr][m.fc] = null;
      const score = minimax(board, depth - 1, -Infinity, Infinity, !isMax, gameCtx);
      board[m.fr][m.fc] = piece;
      if (board[m.tr]) board[m.tr][m.tc] = saved;

      if (isMax ? score > best : score < best) {
        best = score;
        currentBestMove = m;
      }
    }

    if (!timeUp) {
      bestMove = currentBestMove;
      bestOverall = best;
      // Mat topilgan bo'lsa — qidirishni to'xtatish shart emas, lekin chuqurroq borishning ma'nosi yo'q
      if (Math.abs(bestOverall) >= 90000) break;
    } else {
      break; // vaqt tugadi, oxirgi to'liq tugagan chuqurlikning natijasini ishlatamiz
    }
  }

  return bestMove;
}

function getBestMove(board, color, difficulty, gameCtx) {
  return getBestMoveIterative(board, color, difficulty, gameCtx);
}

function aiMoveAsync(board, color, difficulty, callback) {
  const ctx = {
    whiteCitadel: gameState.whiteCitadel,
    blackCitadel: gameState.blackCitadel,
  };
  // Hard darajada hisoblash uzoq davom etishi mumkin — UI bloklanmasligi uchun setTimeout(0)
  setTimeout(() => {
    const move = getBestMove(cloneBoard(board), color, difficulty, ctx);
    callback(move);
  }, 30);
}