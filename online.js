// online.js — Amir Temur Shaxmati Online O'yin Moduli

// supabase.js dan sb ishlatiladi — bu yerda qayta e'lon qilinmaydi

const OnlineGame = {

  // ============================================================
  // HOLAT (State)
  // ============================================================
  state: {
    gameId: null,
    myColor: null,          // 'white' | 'black'
    myUserId: null,
    opponentId: null,
    queueId: null,
    pollingInterval: null,
    realtimeChannel: null,
    timeInterval: null,
    selectedTimeControl: 10, // daqiqa
    isMyTurn: false,
    gameBoard: null,        // joriy taxta holati
    moveHistory: [],
    whiteTimeLeft: 0,       // sekund
    blackTimeLeft: 0,
    isGameActive: false,
    drawOfferReceived: false,
  },

  // ============================================================
  // INITSIALIZATSIYA
  // ============================================================
  async init() {
    const user = await getCurrentUser();
    if (!user) return;
    this.state.myUserId = user.id;

    this.renderLobby();
    this.loadLeaderboard();
    this.subscribeToPresence();
  },

  // ============================================================
  // MATCHMAKING — NAVBATGA QO'SHILISH
  // ============================================================
  async joinQueue() {
    const user = await getCurrentUser();
    if (!user) {
      alert('Kirish kerak!');
      return;
    }
    this.state.myUserId = user.id;

    // Avvalgi navbatdan chiqarish
    await this.leaveQueue();

    const profile = await sb
      .from('profiles')
      .select('elo, nickname')
      .eq('id', user.id)
      .single();

    if (profile.error) {
      console.error('Profile fetch error:', profile.error);
      return;
    }

    // Navbatga qo'shish
    const { data, error } = await sb
      .from('matchmaking_queue')
      .insert({
        user_id: user.id,
        elo: profile.data.elo || 1200,
        time_control: this.state.selectedTimeControl,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) { console.error('Queue error:', error); return; }

    this.state.queueId = data.id;
    this.state.myElo = profile.data.elo || 1200;
    this.state.myNickname = profile.data.nickname || 'Men';
    this.showSearchingUI();

    // Polling boshlash (har 3 sekund)
    this.state.pollingInterval = setInterval(() => {
      this.pollForMatch();
    }, 3000);

    // Darhol bir marta tekshirish
    this.pollForMatch();
  },

  // ============================================================
  // MATCHMAKING — RAQIB QIDIRISH (POLLING)
  // ============================================================
  async pollForMatch() {
    if (!this.state.queueId) return;

    // O'z navbat yozuvini tekshirish
    const { data: myQueue } = await sb
      .from('matchmaking_queue')
      .select('*')
      .eq('id', this.state.queueId)
      .maybeSingle();

    if (!myQueue) {
      // Yozuv o'chirilgan = match topilgan va boshqa tomondan o'chirilgan
      this.clearPolling();
      this.checkForStartedGame();
      return;
    }

    if (myQueue.status === 'matched') {
      this.clearPolling();
      this.checkForStartedGame();
      return;
    }

    // Mos raqib qidirish (ELO ±200)
    const { data: opponents } = await sb
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'waiting')
      .eq('time_control', this.state.selectedTimeControl)
      .neq('user_id', this.state.myUserId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (opponents && opponents.length > 0) {
      const opponent = opponents[0];

      // Poyga holatini oldini olish: ikkala tomon bir vaqtda bir-birini
      // topib, ikkita alohida o'yin yaratmasligi mumkin. Shuning uchun
      // ikkala navbat yozuvini ATOMIK ravishda "matched" holatiga
      // o'tkazishga harakat qilamiz — faqat bu MUVAFFAQIYATLI bo'lsa
      // (ikkala qator ham yangilansa) match yaratiladi.
      const { data: claimed } = await sb
        .from('matchmaking_queue')
        .update({ status: 'matched' })
        .in('id', [myQueue.id, opponent.id])
        .eq('status', 'waiting')
        .select();

      if (!claimed || claimed.length < 2) {
        // Band qilish muvaffaqiyatsiz — raqib allaqachon boshqa klient
        // tomonidan band qilingan. Keyi9ngi pollingda holat tekshiriladi.
        return;
      }

      await this.createMatch(myQueue, opponent);
    }
  },

  // ============================================================
  // MATCHMAKING — MATCH YARATISH
  // ============================================================
  async createMatch(myQueueEntry, opponentQueueEntry) {
    const timeInSeconds = this.state.selectedTimeControl * 60;

    // Raqibning nickname'ini olish (queue'da faqat elo bor, nickname yo'q)
    const { data: opponentProfile } = await sb
      .from('profiles')
      .select('nickname')
      .eq('id', opponentQueueEntry.user_id)
      .single();
    const opponentNickname = opponentProfile?.nickname || 'Raqib';

    // Tasodifiy rang tanlash
    const iAmWhite = Math.random() < 0.5;
    const whiteId = iAmWhite ? this.state.myUserId : opponentQueueEntry.user_id;
    const blackId = iAmWhite ? opponentQueueEntry.user_id : this.state.myUserId;

    // O'yin yaratish
    const { data: game, error } = await sb
      .from('games')
      .insert({
        white_id: whiteId,
        black_id: blackId,
        white_nickname: iAmWhite ? this.state.myNickname : opponentNickname,
        black_nickname: iAmWhite ? opponentNickname : this.state.myNickname,
        white_elo: iAmWhite ? this.state.myElo : opponentQueueEntry.elo,
        black_elo: iAmWhite ? opponentQueueEntry.elo : this.state.myElo,
        time_control: this.state.selectedTimeControl,
        white_time_left: timeInSeconds,
        black_time_left: timeInSeconds,
        white_elo_before: iAmWhite ? this.state.myElo : opponentQueueEntry.elo,
        black_elo_before: iAmWhite ? opponentQueueEntry.elo : this.state.myElo,
        board_state: this.getInitialBoardState(),
        status: 'active'
      })
      .select()
      .single();

    if (error) { console.error('Game create error:', error); return; }

    // Navbatlarni o'chirish
    await sb.from('matchmaking_queue').delete()
      .in('id', [myQueueEntry.id, opponentQueueEntry.id]);

    // O'yinni boshlash
    const myColor = iAmWhite ? 'white' : 'black';
    this.startGame(game.id, myColor, game);
  },

  // ============================================================
  // MATCHMAKING — BOSHQA TOMONDAN BOSHLANGAN O'YINNI TOPISH
  // ============================================================
  async checkForStartedGame() {
    const { data: game } = await sb
      .from('games')
      .select('*')
      .or(`white_id.eq.${this.state.myUserId},black_id.eq.${this.state.myUserId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // single() throws if 0 rows; maybeSingle() returns null safely

    if (game) {
      const myColor = game.white_id === this.state.myUserId ? 'white' : 'black';
      this.startGame(game.id, myColor, game);
    }
  },

  // ============================================================
  // MATCHMAKING — NAVBATDAN CHIQISH
  // ============================================================
  async leaveQueue() {
    this.clearPolling();
    if (this.state.queueId) {
      await sb.from('matchmaking_queue')
        .delete().eq('id', this.state.queueId);
      this.state.queueId = null;
    }
    this.renderLobby();
  },

  clearPolling() {
    if (this.state.pollingInterval) {
      clearInterval(this.state.pollingInterval);
      this.state.pollingInterval = null;
    }
  },

  // ============================================================
  // O'YIN — BOSHLASH
  // ============================================================
  async startGame(gameId, myColor, gameData) {
    this.state.gameId = gameId;
    this.state.myColor = myColor;
    this.state.isGameActive = true;
    this.state.moveHistory = gameData.moves || [];
    this.state.whiteTimeLeft = gameData.white_time_left;
    this.state.blackTimeLeft = gameData.black_time_left;
    this.state.gameBoard = gameData.board_state;
    this.state.isMyTurn = myColor === 'white'; // Oq doim birinchi

    // Raqibning ID sini aniqlash (resign/timeout/rematch uchun zarur)
    this.state.opponentId = myColor === 'white' ? gameData.black_id : gameData.white_id;

    // UI ko'rsatish
    this.showGameUI(gameData);

    // game.js ga online rejimni bildirish
    gameState.mode = 'online';
    gameState.board = gameData.board_state || createInitialBoard();
    gameState.currentTurn = COLOR.WHITE;

    // Canvas ni online-canvas ga o'tkazish
    canvas = document.getElementById('online-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    resizeCanvas();

    // Rang bo'yicha taxtani aylantirish (qora bo'lsa teskari)
    gameState.flipped = (myColor === 'black');

    // Hamla qo'llanilganda online.js ga xabar berish.
    // game.js bu funksiyani har bir mahalliy hamladan keyin
    // o'zining lastMove ob'ektini parametr qilib chaqirishi kerak:
    //   window.onlineOnLocalMoveApplied(lastMove)
    window.onlineOnLocalMoveApplied = (lastMove) => {
      if (!lastMove) return;
      OnlineGame.sendMove(
        { row: lastMove.fr, col: lastMove.fc },
        { row: lastMove.tr, col: lastMove.tc },
        lastMove.promotion || null
      );
    };

    drawBoard();

    // Realtime kanalga ulanish
    this.subscribeToGame(gameId);

    // Taymer boshlash
    this.startTimer();
  },

  selectTime(btn, minutes) {
    document.querySelectorAll('.time-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.selectedTimeControl = minutes;
  },

  // ============================================================
  // REALTIME — O'YIN KANALIGA ULANISH
  // ============================================================
  subscribeToGame(gameId) {
    // Avvalgi kanalni yopish
    if (this.state.realtimeChannel) {
      sb.removeChannel(this.state.realtimeChannel);
    }

    this.state.realtimeChannel = sb
      .channel(`game:${gameId}`)
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        this.receiveMove(payload);
      })
      .on('broadcast', { event: 'resign' }, () => {
        this.handleOpponentResign();
      })
      .on('broadcast', { event: 'time_sync' }, ({ payload }) => {
        this.receiveTimeSync(payload);
      })
      .on('broadcast', { event: 'draw_offer' }, () => {
        this.receiveDrawOffer();
      })
      .on('broadcast', { event: 'draw_response' }, ({ payload }) => {
        this.receiveDrawResponse(payload.accepted);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, ({ new: game }) => {
        if (game.status === 'finished') {
          this.handleGameEnd(game);
        }
      })
      .on('broadcast', { event: 'rematch_offer' }, () => {
        this.receiveRematchOffer();
      })
      .on('broadcast', { event: 'rematch_accept' }, () => {
        document.getElementById('game-result-modal')?.classList.add('hidden');
        this.joinQueue();
      })
      .on('broadcast', { event: 'rematch_decline' }, () => {
        const st = document.getElementById('rematch-status');
        if (st) { st.textContent = 'Raqib revanch rad etdi'; st.classList.remove('hidden'); }
      })
      .subscribe();
  },

  // ============================================================
  // HAMLA — YUBORISH
  // ============================================================
  async sendMove(from, to, promotion = null) {
    if (!this.state.isGameActive) return;
    // Bu funksiya game.js tomonidan hamla MAHALLIY qo'llanilgandan
    // KEYIN chaqiriladi — shu payt gameState.currentTurn allaqachon
    // raqibga o'tgan bo'ladi, shuning uchun bu yerda navbatni
    // qayta tekshirish shart emas (aks holda hamla hech qachon yuborilmaydi).

    const move = {
      from,
      to,
      promotion,
      color: this.state.myColor,
      timestamp: Date.now()
    };

    // Broadcast raqibga
    await sb.channel(`game:${this.state.gameId}`)
      .send({
        type: 'broadcast',
        event: 'move',
        payload: move
      });

    // Taxtaning yangi holatini avval olib olamiz, keyin saqlaymiz
    this.state.gameBoard = window.getBoardState ? window.getBoardState() : this.state.gameBoard;

    // DB ga saqlash
    this.state.moveHistory.push(move);
    await sb.from('games').update({
      moves: this.state.moveHistory,
      board_state: this.state.gameBoard,
      current_turn: this.state.myColor === 'white' ? 'black' : 'white'
    }).eq('id', this.state.gameId);

    this.state.isMyTurn = false;
    this.updateTimerDisplay();
    drawBoard();
  },

  // ============================================================
  // HAMLA — QABUL QILISH
  // ============================================================
  receiveMove(move) {
    if (move.color === this.state.myColor) return;

    if (window.applyOnlineMove) {
      window.applyOnlineMove(move.from, move.to, move.promotion);
    }

    this.state.moveHistory.push(move);
    this.state.isMyTurn = true;
    this.state.gameBoard = window.getBoardState ? window.getBoardState() : this.state.gameBoard;
    this.updateTimerDisplay();
    drawBoard();
  },

  // ============================================================
  // TAYMER
  // ============================================================
  startTimer() {
    if (this.state.timeInterval) clearInterval(this.state.timeInterval);

    this.state.timeInterval = setInterval(() => {
      if (!this.state.isGameActive) return;

      // Navbatdagi o'yinchi vaqti kamayadi
      if (gameState.currentTurn === COLOR.WHITE) {
        this.state.whiteTimeLeft--;
      } else {
        this.state.blackTimeLeft--;
      }

      this.updateTimerDisplay();

      // Vaqt tugashi
      const myTime = this.state.myColor === 'white'
        ? this.state.whiteTimeLeft
        : this.state.blackTimeLeft;

      if (myTime <= 0) {
        this.handleTimeout();
      }
    }, 1000);
  },

  receiveTimeSync(payload) {
    this.state.whiteTimeLeft = payload.white_time;
    this.state.blackTimeLeft = payload.black_time;
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const fmt = (s) => {
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.abs(s) % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const wEl = document.getElementById('white-timer');
    const bEl = document.getElementById('black-timer');
    if (wEl) {
      wEl.textContent = fmt(this.state.whiteTimeLeft);
      wEl.classList.toggle('timer-low', this.state.whiteTimeLeft < 30);
      wEl.classList.toggle('timer-active', this.state.isMyTurn && this.state.myColor === 'white');
    }
    if (bEl) {
      bEl.textContent = fmt(this.state.blackTimeLeft);
      bEl.classList.toggle('timer-low', this.state.blackTimeLeft < 30);
      bEl.classList.toggle('timer-active', this.state.isMyTurn && this.state.myColor === 'black');
    }
  },

  // ============================================================
  // O'YIN TUGASHI
  // ============================================================
  async handleTimeout() {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    clearInterval(this.state.timeInterval);

    const loserId = this.state.myColor === 'white'
      ? this.state.myUserId : this.state.opponentId;
    const winnerId = loserId === this.state.myUserId
      ? this.state.opponentId : this.state.myUserId;

    await this.finishGame(winnerId, 'timeout');
    this.showResultModal(winnerId === this.state.myUserId ? 'win' : 'loss', 'Vaqt tugadi!');
  },

  async handleOpponentResign() {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    clearInterval(this.state.timeInterval);
    await this.finishGame(this.state.myUserId, 'resign');
    this.showResultModal('win', "Raqib taslim bo'ldi!");
  },

  async resign() {
    if (!this.state.isGameActive) return;
    if (!confirm("Haqiqatan ham taslim bo'lasizmi?")) return;

    await sb.channel(`game:${this.state.gameId}`).send({
      type: 'broadcast',
      event: 'resign',
      payload: {}
    });

    this.state.isGameActive = false;
    clearInterval(this.state.timeInterval);
    await this.finishGame(this.state.opponentId, 'resign');
    this.showResultModal('loss', "Siz taslim bo'ldingiz");
  },

  async finishGame(winnerId, reason) {
    // ELO hisoblash
    const { whiteElo, blackElo } = await this.calculateAndUpdateElo(winnerId);

    await sb.from('games').update({
      status: 'finished',
      winner_id: winnerId,
      end_reason: reason,
      white_elo_after: whiteElo,
      black_elo_after: blackElo,
      finished_at: new Date().toISOString()
    }).eq('id', this.state.gameId);
  },

  handleGameEnd(game) {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    clearInterval(this.state.timeInterval);

    const iWon = game.winner_id === this.state.myUserId;
    const isDraw = !game.winner_id;

    if (isDraw) {
      this.showResultModal('draw', 'Durang!');
    } else {
      this.showResultModal(iWon ? 'win' : 'loss',
        iWon ? "G'alaba!" : "Mag'lubiyat");
    }
  },

  // ============================================================
  // ELO HISOBLASH
  // ============================================================
  async calculateAndUpdateElo(winnerId) {
    // O'yin yozuvini (ELO oldingi qiymatlari) olish
    const { data: game } = await sb
      .from('games').select('white_elo_before, black_elo_before, white_id, black_id')
      .eq('id', this.state.gameId).single();

    if (!game) return { whiteElo: 1200, blackElo: 1200 };

    const K = 32;
    const isDraw = !winnerId;
    const whiteWon = !isDraw && winnerId === game.white_id;

    const expectedWhite = 1 / (1 + Math.pow(10, (game.black_elo_before - game.white_elo_before) / 400));
    const expectedBlack = 1 - expectedWhite;

    const whiteResult = isDraw ? 0.5 : (whiteWon ? 1 : 0);
    const blackResult = isDraw ? 0.5 : (whiteWon ? 0 : 1);

    const newWhiteElo = Math.round(game.white_elo_before + K * (whiteResult - expectedWhite));
    const newBlackElo = Math.round(game.black_elo_before + K * (blackResult - expectedBlack));

    // Profillarni yangilash
    await sb.from('profiles').update({ elo: newWhiteElo }).eq('id', game.white_id);
    await sb.from('profiles').update({ elo: newBlackElo }).eq('id', game.black_id);

    return { whiteElo: newWhiteElo, blackElo: newBlackElo };
  },

  // ============================================================
  // DURANG TAKLIFI
  // ============================================================
  async offerDraw() {
    await sb.channel(`game:${this.state.gameId}`).send({
      type: 'broadcast',
      event: 'draw_offer',
      payload: {}
    });
  },

  receiveDrawOffer() {
    this.state.drawOfferReceived = true;
    const btn = document.getElementById('accept-draw-btn');
    if (btn) btn.classList.remove('hidden');
  },

  async acceptDraw() {
    await sb.channel(`game:${this.state.gameId}`).send({
      type: 'broadcast',
      event: 'draw_response',
      payload: { accepted: true }
    });
    this.state.isGameActive = false;
    clearInterval(this.state.timeInterval);
    await this.finishGame(null, 'draw');
    this.showResultModal('draw', 'Durang!');
  },

  async receiveDrawResponse(accepted) {
    if (accepted) {
      this.state.isGameActive = false;
      clearInterval(this.state.timeInterval);
      await this.finishGame(null, 'draw');
      this.showResultModal('draw', 'Durang qabul qilindi!');
    }
  },

  // ============================================================
  // LEADERBOARD
  // ============================================================
  async loadLeaderboard() {
    const { data } = await sb
      .from('profiles')
      .select('id, nickname, elo, avatar_url, win_rate, games_played')
      .order('elo', { ascending: false })
      .limit(20);

    if (!data) return;
    this.renderLeaderboard(data);
  },

  async renderLeaderboard(players) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    const { data: { user } } = await sb.auth.getUser().catch(() => ({ data: {} }));

    tbody.innerHTML = players.map((p, i) => {
      const isMe = user && p.id === user.id;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      return `
        <tr class="${isMe ? 'my-row' : ''}">
          <td>${medal || (i + 1)}</td>
          <td>${p.nickname}</td>
          <td class="elo-cell">${p.elo || 1200}</td>
          <td>${p.win_rate ? p.win_rate + '%' : '-'}</td>
          <td>${p.games_played || '-'}</td>
        </tr>
      `;
    }).join('');
  },

  // ============================================================
  // PRESENCE — ONLAYN FOYDALANUVCHILAR
  // ============================================================
  subscribeToPresence() {
    const presenceChannel = sb.channel('online-users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        const el = document.getElementById('online-count');
        if (el) el.textContent = `Online: ${count}`;
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const user = await getCurrentUser();
          if (user) {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString()
            });
          }
        }
      });
  },

  // ============================================================
  // UI FUNKSIYALARI
  // ============================================================
  renderLobby() {
    const searchBtn = document.getElementById('matchmaking-btn');
    const searchStatus = document.getElementById('matchmaking-status');
    const gameArea = document.getElementById('online-game-area');
    if (searchBtn) searchBtn.classList.remove('hidden');
    if (searchStatus) searchStatus.classList.add('hidden');
    if (gameArea) gameArea.classList.add('hidden');

    document.querySelector('.time-control-select')?.classList.remove('hidden');
    document.querySelector('.matchmaking-area')?.classList.remove('hidden');
    document.querySelector('.leaderboard-section')?.classList.remove('hidden');
  },

  showSearchingUI() {
    const searchBtn = document.getElementById('matchmaking-btn');
    const searchStatus = document.getElementById('matchmaking-status');
    if (searchBtn) searchBtn.classList.add('hidden');
    if (searchStatus) searchStatus.classList.remove('hidden');
  },

  showGameUI(gameData) {
    // Lobby elementlarini yashirish
    document.querySelector('.time-control-select')?.classList.add('hidden');
    document.querySelector('.matchmaking-area')?.classList.add('hidden');
    document.querySelector('.leaderboard-section')?.classList.add('hidden');
    const gameArea = document.getElementById('online-game-area');
    if (gameArea) gameArea.classList.remove('hidden');

    // Rang belgisi
    const colorEl = document.getElementById('my-color-indicator');
    if (colorEl) {
      colorEl.textContent = this.state.myColor === 'white' ? '⬜ Oq' : '⬛ Qora';
    }

    // Men va raqib ma'lumotlarini ko'rsatish
    const isWhite = this.state.myColor === 'white';
    const myNickname = isWhite ? gameData.white_nickname : gameData.black_nickname;
    const myElo = isWhite ? gameData.white_elo : gameData.black_elo;
    const oppNickname = isWhite ? gameData.black_nickname : gameData.white_nickname;
    const oppElo = isWhite ? gameData.black_elo : gameData.white_elo;

    const myNameEl = document.getElementById('my-online-name');
    const myEloEl = document.getElementById('my-online-elo');
    const oppNameEl = document.getElementById('opponent-name');
    const oppEloEl = document.getElementById('opponent-elo');

    if (myNameEl) myNameEl.textContent = myNickname || 'Siz';
    if (myEloEl) myEloEl.textContent = myElo || 1200;
    if (oppNameEl) oppNameEl.textContent = oppNickname || 'Raqib';
    if (oppEloEl) oppEloEl.textContent = oppElo || 1200;

    this.updateTimerDisplay();
  },

  showResultModal(result, message, eloChange = null) {
    const modal = document.getElementById('game-result-modal');
    const msgEl  = document.getElementById('result-message');
    const iconEl = document.getElementById('result-icon');
    const eloEl  = document.getElementById('elo-change');

    const icons = { win: '🏆', loss: '😔', draw: '🤝' };
    if (iconEl) iconEl.textContent = icons[result] || '🏁';
    if (msgEl)  msgEl.textContent  = message;

    if (eloEl && eloChange !== null) {
      const sign   = eloChange > 0 ? '+' : '';
      const color  = eloChange > 0 ? '#2ecc71' : eloChange < 0 ? '#e74c3c' : '#aaa';
      eloEl.innerHTML = `ELO: <span style="color:${color};font-weight:bold">${sign}${eloChange}</span>`;
    } else if (eloEl) {
      eloEl.textContent = '';
    }

    if (modal) modal.classList.remove('hidden');
  },

  rematchCounts: {},

  closeResultModal() {
    document.getElementById('game-result-modal')?.classList.add('hidden');
    this.renderLobby();
  },

  async sendRematch() {
    const opId = this.state.opponentId;
    if (!opId) return;
    this.rematchCounts[opId] = (this.rematchCounts[opId] || 0) + 1;
    if (this.rematchCounts[opId] > 3) {
      const st = document.getElementById('rematch-status');
      if (st) { st.textContent = "Maksimal revanch so'rovlari yuborildi (3)"; st.classList.remove('hidden'); }
      return;
    }
    await sb.channel(`rematch:${this.state.gameId}`).send({
      type: 'broadcast', event: 'rematch_offer',
      payload: { from: this.state.myUserId }
    });
    const st = document.getElementById('rematch-status');
    if (st) { st.textContent = "Revanch so'rovi yuborildi..."; st.classList.remove('hidden'); }
    document.getElementById('rematch-send-btn')?.setAttribute('disabled', true);
  },

  receiveRematchOffer() {
    const incoming = document.getElementById('rematch-incoming');
    if (incoming) incoming.classList.remove('hidden');
  },

  async acceptRematch() {
    await sb.channel(`rematch:${this.state.gameId}`).send({
      type: 'broadcast', event: 'rematch_accept', payload: {}
    });
    document.getElementById('game-result-modal')?.classList.add('hidden');
    this.joinQueue();
  },

  async declineRematch() {
    await sb.channel(`rematch:${this.state.gameId}`).send({
      type: 'broadcast', event: 'rematch_decline', payload: {}
    });
    document.getElementById('rematch-incoming')?.classList.add('hidden');
  },

  getInitialBoardState() {
    if (window.createInitialBoard) return window.createInitialBoard();
    return null;
  }

}; // OnlineGame oxiri

// ============================================================
// EKSPORT VA EVENT LISTENERLAR
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Vaqt nazorati tanlash
  document.querySelectorAll('.time-control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-control-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      OnlineGame.state.selectedTimeControl = parseInt(btn.dataset.minutes);
    });
  });

  // Raqib qidirish tugmasi
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) searchBtn.addEventListener('click', () => OnlineGame.joinQueue());

  // Bekor qilish
  const cancelBtn = document.getElementById('cancel-search-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => OnlineGame.leaveQueue());

  // Taslim bo'lish
  const resignBtn = document.getElementById('resign-btn');
  if (resignBtn) resignBtn.addEventListener('click', () => OnlineGame.resign());

  // Durang taklifi
  const drawBtn = document.getElementById('draw-btn');
  if (drawBtn) drawBtn.addEventListener('click', () => OnlineGame.offerDraw());

  // Durang qabul qilish
  const acceptDrawBtn = document.getElementById('accept-draw-btn');
  if (acceptDrawBtn) acceptDrawBtn.addEventListener('click', () => OnlineGame.acceptDraw());

  // Qayta o'ynash
  const rematchBtn = document.getElementById('rematch-btn');
  if (rematchBtn) rematchBtn.addEventListener('click', () => {
    document.getElementById('game-result-modal')?.classList.add('hidden');
    OnlineGame.renderLobby();
  });
});

// Global chiqarish
window.OnlineGame = OnlineGame;
window.dispatchEvent(new Event('onlineGameReady'));