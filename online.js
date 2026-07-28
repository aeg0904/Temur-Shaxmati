// online.js — Amir Temur Shaxmati Online O'yin Moduli
//
// ============================================================
// BU FAYL NIMA UCHUN QAYTA YOZILDI
// ============================================================
// Eski versiyada onlayn sinxronizatsiyani buzadigan bir nechta jiddiy
// xato bor edi. Ular shu yerda tuzatildi:
//
//  1) FEEDBACK LOOP (eng og'ir xato): raqibdan kelgan hamla
//     window.applyOnlineMove() orqali taxtaga qo'llanganda, bu ham
//     game.js dagi finishMove()/applyMove() ni chaqirar edi — u esa
//     mode==='online' bo'lsa, HAR DOIM window.onlineOnLocalMoveApplied()
//     ni chaqirar edi. Natijada: raqibning hamlasi qabul qilinishi
//     bilan darhol "o'zimiznikidek" qayta serverga va broadcastga
//     yuborilar edi — bu esa taxtalarning bir-biridan uzilib qolishiga,
//     navbat aralashib ketishiga va hatto ikki karra hamla qo'llanishiga
//     olib kelardi. Tuzatildi: state.applyingRemoteMove bayrog'i orqali
//     (qarang: game.js dagi 3 ta chaqiruv nuqtasi).
//
//  2) window.getBoardState() HECH QACHON e'lon qilinmagan edi — shuning
//     uchun DB ga saqlangan board_state doim eskirgan (o'yin boshidagi)
//     holat bo'lib qolar edi. Sahifani yangilagan yoki qayta ulangan
//     o'yinchi taxtani noto'g'ri (boshlang'ich) holatda ko'rar edi.
//     Tuzatildi: window.getBoardState() endi game.js da e'lon qilinadi.
//
//  3) Broadcast — Supabase Realtime'da KAFOLATLANMAGAN, vaqtinchalik
//     signal. Eski kodda FAQAT broadcastga tayanilardi va bitta ham
//     "server = haqiqat manbai" mexanizmi yo'q edi. Endi: har bir
//     hamla AVVAL bazaga (games jadvali) yoziladi — bu haqiqat manbai
//     — keyin broadcast tezkor bildirishnoma sifatida yuboriladi.
//     Broadcast yo'qolib qolsa ham, postgres_changes orqali yoki
//     qayta ulanganda avtomatik "reconcile" (moslashtirish) ishlaydi.
//
//  4) Har bir sendMove/resign/offerDraw/... da YANGI, HECH QACHON
//     obuna bo'lmagan `sb.channel(...)` obyekti yaratilib, unga
//     to'g'ridan-to'g'ri .send() chaqirilar edi. Obuna bo'lmagan
//     kanalga yuborilgan xabar ko'pincha yetib bormaydi. Endi bitta
//     doimiy, chindan ham obuna qilingan kanal qayta ishlatiladi.
//
//  5) Uzilib qolgan ulanishni (mobil qurilma fon rejimiga o'tishi,
//     tarmoq uzilishi) qayta tiklash mexanizmi yo'q edi. Endi kanal
//     holati kuzatiladi va CLOSED/CHANNEL_ERROR/TIMED_OUT bo'lganda
//     eksponensial kechikish bilan qayta ulanadi + serverdan holatni
//     qayta sinxronlaydi.
//
//  6) time_sync eventi e'lon qilingan, lekin HECH QACHON yuborilmagan
//     edi (o'lik kod) — taymerlar ikki tomonda mustaqil hisoblanib,
//     vaqt o'tishi bilan bir-biridan siljib ketardi. Endi har 5
//     sekundda faol o'yinchi tomonidan yuboriladi.
//
//  7) handleOpponentResign() chaqirilardi, lekin HECH QACHON e'lon
//     qilinmagan edi — raqib taslim bo'lganda qabul qiluvchi
//     tomonda JavaScript xatosi kelib chiqib, natija ekrani
//     ko'rsatilmay qolardi. Endi to'liq amalga oshirilgan.
//
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
    channelReadyPromise: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    timeInterval: null,
    timeSyncInterval: null,
    selectedTimeControl: 10, // daqiqa
    isMyTurn: false,
    gameBoard: null,        // joriy taxta holati
    moveHistory: [],
    whiteTimeLeft: 0,       // sekund
    blackTimeLeft: 0,
    isGameActive: false,
    drawOfferReceived: false,
    applyingRemoteMove: false, // TRUE bo'lganda finishMove() qayta yubormasligi kerak
    myElo: 1200,
    myNickname: 'Men',
  },

  _visibilityBound: false,

  // ============================================================
  // INITSIALIZATSIYA
  // ============================================================
  async init() {
    const user = await getCurrentUser();
    if (!user) return;
    this.state.myUserId = user.id;

    this.renderLobby();
    this.loadLeaderboard();

    // Sahifa qayta yuklanganda faol o'yin bo'lsa, unga qaytish.
    await this.checkForStartedGame();

    // Sahifa fondan qaytganda (masalan, mobil tab almashtirilganda)
    // serverdan holatni bir marta qayta tekshiramiz — broadcast
    // shu vaqt ichida o'tkazib yuborilgan bo'lishi mumkin.
    if (!this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.state.isGameActive) {
          this.reconcileFromServer();
        }
      });
    }

    // Sahifa yopilayotganda navbatdan chiqishga urinib ko'ramiz
    // (kafolatlanmagan, lekin "arvoh" yozuvlar sonini kamaytiradi —
    // asosiy himoya baribir pollForMatch dagi presence tekshiruvi).
    if (!this._unloadBound) {
      this._unloadBound = true;
      window.addEventListener('pagehide', () => {
        if (this.state.queueId) {
          sb.from('matchmaking_queue').delete().eq('id', this.state.queueId);
        }
      });
    }
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

    // MUHIM: faqat state.queueId emas — shu foydalanuvchiga tegishli
    // BARCHA eski navbat yozuvlarini o'chiramiz. Aks holda, oldingi
    // sessiya (masalan sahifa yopilib, leaveQueue() chaqirilmay qolgan
    // holat) qoldirgan "arvoh" yozuv navbatda qolib, boshqa
    // o'yinchilarni bo'sh (hech kim ulanmagan) profil bilan
    // "moslashtirib" yuborishi mumkin edi.
    await sb.from('matchmaking_queue').delete().eq('user_id', user.id);

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

    // Polling boshlash (har 2 sekund)
    this.state.pollingInterval = setInterval(() => {
      this.pollForMatch();
    }, 2000);

    // Darhol bir marta tekshirish
    this.pollForMatch();
  },

  // ============================================================
  // MATCHMAKING — RAQIB QIDIRISH (POLLING)
  // ============================================================
  async pollForMatch() {
    if (!this.state.queueId) return;

    try {
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

      // Mos raqib qidirish. Eslatma: bir nechta nomzod olamiz (faqat 1
      // emas), chunki eng qadimgi yozuv "arvoh" (uzilib qolgan
      // foydalanuvchi) bo'lishi mumkin — shunda keyingisini sinaymiz.
      const { data: opponents } = await sb
        .from('matchmaking_queue')
        .select('*')
        .eq('status', 'waiting')
        .eq('time_control', this.state.selectedTimeControl)
        .neq('user_id', this.state.myUserId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (!opponents || opponents.length === 0) return;

      // Faqat HOZIR haqiqatan onlayn (site-presence kanalida ko'ringan)
      // foydalanuvchini raqib sifatida tanlaymiz. Bu — sahifasi
      // yopilgan/qulagan, lekin navbat yozuvi o'chirilmagan "arvoh"
      // foydalanuvchi bilan mos kelib qolishning oldini oladi.
      const staleIds = [];
      let opponent = null;
      for (const cand of opponents) {
        if (window.isUserOnline && window.isUserOnline(cand.user_id)) {
          opponent = cand;
          break;
        }
        // 20 soniyadan eskirgan va onlayn ko'rinmayotgan yozuv —
        // deyarli aniq arvoh, tozalash uchun belgilaymiz.
        if (Date.now() - new Date(cand.created_at).getTime() > 20000) {
          staleIds.push(cand.id);
        }
      }

      // Eskirgan/arvoh yozuvlarni fonda tozalaymiz (xatoni e'tiborsiz
      // qoldiramiz — bu shunchaki gigiena, kritik emas).
      if (staleIds.length) {
        sb.from('matchmaking_queue').delete().in('id', staleIds)
          .then(() => {}, () => {});
      }

      if (!opponent) return; // hozircha haqiqatan onlayn raqib yo'q

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
        // Claim muvaffaqiyatsiz. Ikkita holat bo'lishi mumkin:
        // (a) hech qaysi qator yangilanmadi — hech narsa qilish shart emas.
        // (b) faqat BITTASI (odatda bizniki) yangilandi — bu holda uni
        //     'waiting'ga qaytarib, navbatda qolishimiz kerak, aks holda
        //     o'yinchi hech qanday o'yinsiz 'matched' holatida qolib ketadi.
        if (claimed && claimed.length === 1 && claimed[0].id === myQueue.id) {
          await sb.from('matchmaking_queue')
            .update({ status: 'waiting' })
            .eq('id', myQueue.id);
        }
        return;
      }

      await this.createMatch(myQueue, opponent);
    } catch (err) {
      console.error('pollForMatch xatosi:', err);
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
        current_turn: 'white',
        moves: [],
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
    // Eski o'yindan qolgan intervallar/kanallar bo'lsa, tozalaymiz
    this.stopRealtime();

    this.state.gameId = gameId;
    this.state.myColor = myColor;
    this.state.isGameActive = true;
    this.state.moveHistory = gameData.moves || [];
    this.state.whiteTimeLeft = gameData.white_time_left;
    this.state.blackTimeLeft = gameData.black_time_left;
    this.state.gameBoard = gameData.board_state;

    // Navbatni saqlangan holatdan olish, oq birinchi deb faraz qilmaslik
    const currentTurnColor = gameData.current_turn === 'black' ? COLOR.BLACK : COLOR.WHITE;
    this.state.isMyTurn = (myColor === 'white' && currentTurnColor === COLOR.WHITE) ||
                          (myColor === 'black' && currentTurnColor === COLOR.BLACK);

    // Raqibning ID sini aniqlash (resign/timeout/rematch uchun zarur)
    this.state.opponentId = myColor === 'white' ? gameData.black_id : gameData.white_id;

    // UI ko'rsatish
    this.showGameUI(gameData);

    // game.js ga online rejimni bildirish
    gameState.mode = 'online';
    gameState.board = gameData.board_state || createInitialBoard();
    gameState.currentTurn = currentTurnColor;

    // Canvas ni online-canvas ga o'tkazish
    canvas = document.getElementById('online-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    resizeCanvas();

    // MUHIM: initGame() click/mousemove listenerlarni FAQAT #game-board
    // canvasiga bog'laydi. Bu yerda canvas #online-canvas ga
    // almashtirilgani uchun, listenerlarni ham shu YANGI canvas
    // elementiga qayta bog'lashimiz shart — aks holda taxtani bosish
    // hech qanday amalga olib kelmaydi (donalar "rasm"dek turib qoladi).
    if (canvas) {
      canvas.removeEventListener('click',      onBoardClick);
      canvas.removeEventListener('mousemove',  onBoardHover);
      canvas.removeEventListener('mouseleave', this._onLeave);
      canvas.addEventListener('click',      onBoardClick);
      canvas.addEventListener('mousemove',  onBoardHover);
      this._onLeave = () => { hoverCell = null; drawBoard(); };
      canvas.addEventListener('mouseleave', this._onLeave);
    }

    // Rang bo'yicha taxtani aylantirish (qora bo'lsa teskari) —
    // buildCoords() harf/raqam yorliqlarini shu orientatsiyaga mos
    // qayta chizadi.
    gameState.flipped = (myColor === 'black');
    buildCoords();

    // Hamla qo'llanilganda online.js ga xabar berish.
    // game.js bu funksiyani MAHALLIY hamladan keyin chaqiradi. Raqibdan
    // kelgan hamlalar uchun ham xuddi shu yo'l chaqiriladi, shuning
    // uchun game.js state.applyingRemoteMove bayrog'ini tekshiradi va
    // faqat HAQIQIY mahalliy hamlalarda bu callback ishga tushadi.
    window.onlineOnLocalMoveApplied = (lastMove) => {
      if (!lastMove) return;
      OnlineGame.sendMove(
        { row: lastMove.fr, col: lastMove.fc },
        { row: lastMove.tr, col: lastMove.tc },
        lastMove.promotion || null
      );
    };

    drawBoard();

    // Realtime kanalga ulanish (bitta doimiy, obuna qilingan kanal)
    this.subscribeToGame(gameId);

    // Taymerlar
    this.startTimer();
    this.startTimeSyncLoop();
  },

  selectTime(btn, minutes) {
    document.querySelectorAll('.time-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.selectedTimeControl = minutes;
  },

  // ============================================================
  // REALTIME — O'YIN KANALIGA ULANISH (bitta doimiy kanal)
  // ============================================================
  subscribeToGame(gameId) {
    if (this.state.reconnectTimer) {
      clearTimeout(this.state.reconnectTimer);
      this.state.reconnectTimer = null;
    }
    if (this.state.realtimeChannel) {
      sb.removeChannel(this.state.realtimeChannel);
      this.state.realtimeChannel = null;
    }

    this.state.channelReadyPromise = new Promise((resolve) => {
      const channel = sb
        .channel(`game:${gameId}`, { config: { broadcast: { self: false, ack: true } } })
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
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        }, ({ new: game }) => {
          this.handleGameRowUpdate(game);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.state.reconnectAttempts = 0;
            resolve();
            // Qayta ulanganda (yoki birinchi marta) serverdagi eng so'nggi
            // holat bilan moslashtiramiz — broadcast o'tkazib yuborilgan
            // hamlalarni tiklaydi.
            this.reconcileFromServer();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.scheduleReconnect(gameId);
          }
        });

      this.state.realtimeChannel = channel;
    });

    return this.state.channelReadyPromise;
  },

  // Ulanish uzilganda eksponensial kechikish bilan qayta urinish
  scheduleReconnect(gameId) {
    if (!this.state.isGameActive || this.state.gameId !== gameId) return;
    if (this.state.reconnectTimer) return; // allaqachon rejalashtirilgan

    const delay = Math.min(1000 * Math.pow(2, this.state.reconnectAttempts), 10000);
    this.state.reconnectAttempts++;

    this.state.reconnectTimer = setTimeout(() => {
      this.state.reconnectTimer = null;
      if (this.state.isGameActive && this.state.gameId === gameId) {
        this.subscribeToGame(gameId);
      }
    }, delay);
  },

  // Har qanday broadcast yuborishdan oldin kanal obuna bo'lguncha kutamiz
  async ensureChannelReady() {
    if (this.state.channelReadyPromise) {
      await this.state.channelReadyPromise;
    }
  },

  async broadcast(event, payload = {}) {
    await this.ensureChannelReady();
    if (!this.state.realtimeChannel) return;
    try {
      await this.state.realtimeChannel.send({ type: 'broadcast', event, payload });
    } catch (err) {
      // Broadcast yetib bormasa ham xavotir emas — DB orqali (reconcile)
      // baribir sinxronlanadi.
      console.warn(`Broadcast "${event}" yuborilmadi:`, err);
    }
  },

  // ============================================================
  // SERVER BILAN MOSLASHTIRISH (RECONCILE) — asosiy ishonchlilik tayanchi
  // ============================================================
  // Broadcast Supabase Realtime'da kafolatlanmagan signal. Shu sababli
  // "haqiqat manbai" doim `games` jadvalidagi qator hisoblanadi. Bu
  // funksiya joriy DB holatini mahalliy holat bilan solishtiradi va
  // agar serverda ko'proq hamla bo'lsa (broadcast o'tkazib yuborilgan
  // bo'lsa), taxtani serverdagi board_state'ga moslaydi.
  async reconcileFromServer(game = null) {
    if (!this.state.isGameActive || !this.state.gameId) return;

    if (!game) {
      const { data } = await sb.from('games').select('*').eq('id', this.state.gameId).maybeSingle();
      game = data;
    }
    if (!game) return;

    if (game.status === 'finished') {
      this.handleGameEnd(game);
      return;
    }

    const dbMoves = game.moves || [];
    if (dbMoves.length > this.state.moveHistory.length) {
      this.state.moveHistory = dbMoves;
      this.state.gameBoard = game.board_state;
      gameState.board = game.board_state;

      const turnColor = game.current_turn === 'black' ? COLOR.BLACK : COLOR.WHITE;
      gameState.currentTurn = turnColor;
      this.state.isMyTurn = (this.state.myColor === 'white' && turnColor === COLOR.WHITE) ||
                             (this.state.myColor === 'black' && turnColor === COLOR.BLACK);
      drawBoard();
    }

    // Vaqtlarni ham serverdagi so'nggi saqlangan qiymatga moslaymiz —
    // bir necha soniyalik farq bo'lishi mumkin, lekin butunlay
    // sinxronlanmagandan ancha yaxshi.
    if (typeof game.white_time_left === 'number') this.state.whiteTimeLeft = game.white_time_left;
    if (typeof game.black_time_left === 'number') this.state.blackTimeLeft = game.black_time_left;
    this.updateTimerDisplay();
  },

  handleGameRowUpdate(game) {
    if (game.status === 'finished') {
      this.handleGameEnd(game);
      return;
    }
    // Zaxira sinxronizatsiya: broadcast tushib qolgan bo'lsa ham,
    // bazadagi UPDATE hodisasi taxtani to'g'rilaydi.
    this.reconcileFromServer(game);
  },

  // ============================================================
  // HAMLA — YUBORISH
  // ============================================================
  async sendMove(from, to, promotion = null) {
    if (!this.state.isGameActive) return;
    // Bu funksiya game.js tomonidan hamla MAHALLIY qo'llanilgandan
    // KEYIN chaqiriladi — shu payt gameState.currentTurn allaqachon
    // raqibga o'tgan bo'ladi, shuning uchun bu yerda navbatni
    // qayta tekshirish shart emas.

    const move = {
      from,
      to,
      promotion,
      color: this.state.myColor,
      timestamp: Date.now()
    };

    // Taxtaning yangilangan holatini olamiz (game.js da e'lon qilingan)
    this.state.gameBoard = window.getBoardState ? window.getBoardState() : this.state.gameBoard;
    this.state.moveHistory.push(move);
    this.state.isMyTurn = false;

    const nextTurn = this.state.myColor === 'white' ? 'black' : 'white';

    // 1) MANBA — avval bazaga yozamiz. Broadcast vaqtinchalik va
    //    kafolatlanmagan bo'lgani uchun DB har doim haqiqat manbai
    //    bo'lib qoladi (reconcileFromServer shu yerga tayanadi).
    await this.persistWithRetry({
      moves: this.state.moveHistory,
      board_state: this.state.gameBoard,
      current_turn: nextTurn,
      white_time_left: this.state.whiteTimeLeft,
      black_time_left: this.state.blackTimeLeft
    });

    // 2) Tezkor bildirishnoma — raqib DB pollingini kutmasdan darhol
    //    ko'radi. ack:true bo'lgani uchun send() serverga yetib
    //    borguncha kutadi.
    await this.broadcast('move', move);

    this.updateTimerDisplay();
    drawBoard();
  },

  // O'yin faol ekan, xato bo'lsa saqlashni bir necha marta qayta urinish
  async persistWithRetry(fields, attempt = 1) {
    try {
      const { error } = await sb.from('games').update(fields).eq('id', this.state.gameId);
      if (error) throw error;
    } catch (err) {
      console.warn(`O'yin holatini saqlashda xatolik (urinish ${attempt}):`, err);
      if (this.state.isGameActive && attempt <= 4) {
        setTimeout(() => this.persistWithRetry(fields, attempt + 1), 1000 * attempt);
      }
    }
  },

  // ============================================================
  // HAMLA — QABUL QILISH
  // ============================================================
  receiveMove(move) {
    if (!move || move.color === this.state.myColor) return;

    // Bir xil hamla ikki marta (broadcast + reconcile) qo'llanmasligi
    // uchun tekshiruv.
    const alreadyApplied = this.state.moveHistory.some(m =>
      m.timestamp === move.timestamp &&
      m.from?.row === move.from?.row && m.from?.col === move.from?.col &&
      m.to?.row === move.to?.row && m.to?.col === move.to?.col
    );
    if (alreadyApplied) return;

    // Bu bayroq game.js ga: "bu hamla raqibdan keldi, uni qayta
    // serverga yuborma" deb bildiradi.
    this.state.applyingRemoteMove = true;
    if (window.applyOnlineMove) {
      window.applyOnlineMove(move.from, move.to, move.promotion);
    }
    this.state.applyingRemoteMove = false;

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

      if (gameState.currentTurn === COLOR.WHITE) {
        this.state.whiteTimeLeft--;
      } else {
        this.state.blackTimeLeft--;
      }

      this.updateTimerDisplay();

      // Har ikkala tomonning vaqtini tekshiramiz — faqat o'zimizni
      // emas, chunki raqib kliyenti yopilib qolgan bo'lishi mumkin,
      // shu holatda ham vaqt tugashi aniqlanishi kerak.
      if (this.state.whiteTimeLeft <= 0) {
        this.handleTimeout('white');
      } else if (this.state.blackTimeLeft <= 0) {
        this.handleTimeout('black');
      }
    }, 1000);
  },

  // Taymerlarni davriy ravishda raqibga yuborib turish — ikki tomon
  // soati bir-biridan siljib ketmasligi uchun (avval bu event hech
  // qachon yuborilmagan edi).
  startTimeSyncLoop() {
    if (this.state.timeSyncInterval) clearInterval(this.state.timeSyncInterval);
    this.state.timeSyncInterval = setInterval(() => {
      if (!this.state.isGameActive) return;
      this.broadcast('time_sync', {
        white_time: this.state.whiteTimeLeft,
        black_time: this.state.blackTimeLeft
      });
    }, 5000);
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
  async handleTimeout(timedOutColor) {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    this.stopRealtime();

    const loserId = timedOutColor === this.state.myColor
      ? this.state.myUserId : this.state.opponentId;
    const winnerId = loserId === this.state.myUserId
      ? this.state.opponentId : this.state.myUserId;

    await this.finishGame(winnerId, 'timeout');
    this.showResultModal(winnerId === this.state.myUserId ? 'win' : 'loss', 'Vaqt tugadi!');
  },

  async resign() {
    if (!this.state.isGameActive) return;
    if (!confirm("Haqiqatan ham taslim bo'lasizmi?")) return;

    await this.broadcast('resign');

    this.state.isGameActive = false;
    this.stopRealtime();
    await this.finishGame(this.state.opponentId, 'resign');
    this.showResultModal('loss', "Siz taslim bo'ldingiz");
  },

  // Raqib taslim bo'lganda ushbu klientda ishga tushadi (eski kodda bu
  // funksiya chaqirilar, lekin hech qachon e'lon qilinmagan edi — shu
  // sabab qabul qiluvchi tomon xatoga uchrab, natija ekranini
  // ko'rmay qolardi).
  handleOpponentResign() {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    this.stopRealtime();
    this.showResultModal('win', "Raqib taslim bo'ldi!");
  },

  async finishGame(winnerId, reason) {
    // ELO hisoblash
    const { whiteElo, blackElo } = await this.calculateAndUpdateElo(winnerId);

    // status='active' shartini qo'shamiz — shu bilan agar ikkala
    // klient ham deyarli bir vaqtda o'yinni tugatishga urinsa
    // (masalan, ikkalasi ham vaqt tugaganini aniqlasa), faqat
    // birinchisi yozadi, ikkinchisi hech narsani buzmaydi.
    await sb.from('games').update({
      status: 'finished',
      winner_id: winnerId,
      end_reason: reason,
      white_elo_after: whiteElo,
      black_elo_after: blackElo,
      finished_at: new Date().toISOString()
    }).eq('id', this.state.gameId).eq('status', 'active');
  },

  handleGameEnd(game) {
    if (!this.state.isGameActive) return;
    this.state.isGameActive = false;
    this.stopRealtime();

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
    await this.broadcast('draw_offer');
  },

  receiveDrawOffer() {
    this.state.drawOfferReceived = true;
    const btn = document.getElementById('accept-draw-btn');
    if (btn) btn.classList.remove('hidden');
  },

  async acceptDraw() {
    await this.broadcast('draw_response', { accepted: true });
    this.state.isGameActive = false;
    this.stopRealtime();
    await this.finishGame(null, 'draw');
    this.showResultModal('draw', 'Durang!');
  },

  async receiveDrawResponse(accepted) {
    if (accepted) {
      this.state.isGameActive = false;
      this.stopRealtime();
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
    await this.broadcast('rematch_offer', { from: this.state.myUserId });
    const st = document.getElementById('rematch-status');
    if (st) { st.textContent = "Revanch so'rovi yuborildi..."; st.classList.remove('hidden'); }
    document.getElementById('rematch-send-btn')?.setAttribute('disabled', true);
  },

  receiveRematchOffer() {
    const incoming = document.getElementById('rematch-incoming');
    if (incoming) incoming.classList.remove('hidden');
  },

  async acceptRematch() {
    await this.broadcast('rematch_accept');
    document.getElementById('game-result-modal')?.classList.add('hidden');
    this.joinQueue();
  },

  async declineRematch() {
    await this.broadcast('rematch_decline');
    document.getElementById('rematch-incoming')?.classList.add('hidden');
  },

  // ============================================================
  // TOZALASH — intervallar va kanalni to'xtatish
  // ============================================================
  // Barcha o'yin-tugash yo'llari (taslim, vaqt tugashi, durang,
  // raqibning taslim bo'lishi, o'yin tugashi) shu yagona funksiyani
  // chaqiradi — shunda hech qanday interval yoki obuna "osilib"
  // qolmaydi va keyingi o'yinga to'sqinlik qilmaydi.
  stopRealtime() {
    if (this.state.timeInterval) { clearInterval(this.state.timeInterval); this.state.timeInterval = null; }
    if (this.state.timeSyncInterval) { clearInterval(this.state.timeSyncInterval); this.state.timeSyncInterval = null; }
    if (this.state.reconnectTimer) { clearTimeout(this.state.reconnectTimer); this.state.reconnectTimer = null; }
    if (this.state.realtimeChannel) {
      sb.removeChannel(this.state.realtimeChannel);
      this.state.realtimeChannel = null;
    }
    this.state.channelReadyPromise = null;
    this.state.reconnectAttempts = 0;
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