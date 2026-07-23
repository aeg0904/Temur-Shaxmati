// ============================================================
//  AMIR TEMUR SHAXMATI — app.js
//  Online va Puzzles uchun global koordinatsiya
// ============================================================

let selectedTimeControl = 10;

function selectTimeControl(btn, minutes) {
  selectedTimeControl = minutes;
  document.querySelectorAll('.time-card').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── LEADERBOARD ───────────────────────────────────────────────
async function loadLeaderboard() {
  const table = document.getElementById('leaderboard-table');
  if (!table) return;

  try {
    const { data } = await getSb()
      .from('leaderboard')
      .select('*')
      .limit(10);

   if (!data?.length) {
      table.innerHTML = `<div class="lb-row lb-header">
        <span>#</span><span>${t('lb_nickname')}</span><span>ELO</span>
        <span>${t('lb_winrate')}</span><span>${t('lb_games')}</span>
      </div>
      <div class="lb-empty">${t('lb_empty') || "Hali o'yinlar yo'q"}</div>`;
      return;
    }


    const myId = currentUser?.id;
    table.innerHTML = `<div class="lb-row lb-header">
      <span>#</span><span>${t('lb_nickname')}</span><span>ELO</span>
      <span>${t('lb_winrate')}</span><span>${t('lb_games')}</span>
    </div>` + data.map(row => `
      <div class="lb-row ${row.id === myId ? 'lb-me' : ''}">
        <span class="lb-rank">${row.rank}</span>
        <span class="lb-nick">${row.nickname}</span>
        <span class="lb-elo">${row.elo}</span>
        <span class="lb-wr">${row.win_rate}%</span>
        <span class="lb-games">${row.games_played}</span>
      </div>`).join('');
  } catch (e) {
    table.innerHTML += `<div class="lb-empty">Yuklab bo'lmadi</div>`;
  }
}

// ── SHOWSECTION OVERRIDE ──────────────────────────────────────
// game.js dagi showSection ni kengaytiramiz
const _origShowSection = typeof showSection === 'function' ? showSection : null;

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(name)?.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.getAttribute('href') === '#' + name));

  if (name === 'tutorial') setTimeout(() => initTutorial(), 50);
  if (name === 'game') {
    document.getElementById('mode-select')?.classList.remove('hidden');
    document.getElementById('game-ui')?.classList.add('hidden');
  }
  if (name === 'online') {
    loadLeaderboard();
    initOnlineCanvas();
  }
  if (name === 'puzzles') {
    setTimeout(() => onPuzzleSectionOpen(), 50);
  }
  if (name === 'admin') {
    setTimeout(() => onAdminSectionOpen(), 50);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initOnlineCanvas() {
  // Online o'yin oddiy game canvas dan foydalanadi
}

// ── GAME.JS APPLYOMOVE HOOK ───────────────────────────────────
// game.js dagi applyMove ni wrap qilamiz
document.addEventListener('DOMContentLoaded', () => {
  // Online hamlalar uchun hook
  const _origApply = typeof applyMove === 'function' ? applyMove : null;
  if (!_origApply) return;

  window.__origApplyMove = _origApply;
  // Bu yerda game.js dagi applyMove dan onOnlineMoveApplied chaqiriladi
  // game.js da `onOnlineMoveApplied(fr, fc, tr, tc)` chaqiruvi qo'shilishi kerak
});

// ── O'YIN REJIMIGA QARAB DISPATCH ────────────────────────────
// game.js handleCellClick game_mode ni ko'rib puzzle/online ga dispatch qiladi
document.addEventListener('DOMContentLoaded', () => {
  loadLeaderboard();
});

// ── TIL O'ZGARGANDA — LEADERBOARD QAYTA CHIZILSIN ─────────────
document.addEventListener('langChanged', () => {
  // Faqat Online sahifa ochiq bo'lsa qayta yuklaymiz (keraksiz so'rovni oldini olish uchun)
  const onlineSection = document.getElementById('online');
  if (onlineSection && !onlineSection.classList.contains('hidden')) {
    loadLeaderboard();
  }
});


// ============================================================
//  TEMA TIZIMI — Temur (default) <-> Imperial Minimalism
//  app.js ning OXIRIGA qo'shing
// ============================================================

const THEME_KEY = 'atc_theme';

function getCurrentTheme() {
  return localStorage.getItem(THEME_KEY) || 'temur';
}

function setTheme(theme) {
  if (theme !== 'temur' && theme !== 'imperial') return;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleUI();
  applyBoardThemeColors(theme);
}

function toggleTheme() {
  const current = getCurrentTheme();
  setTheme(current === 'temur' ? 'imperial' : 'temur');
}

function updateThemeToggleUI() {
  const current = getCurrentTheme();
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme-opt') === current);
  });
}

// ── TAXTA RANGLARINI TEMAGA MOSLASH (canvas JS bilan chiziladi) ─
const BOARD_THEMES = {
  temur: {
    light: '#F0D9B5',
    dark:  '#B58863',
    selected: 'rgba(255,215,0,0.70)',
    lastMove: 'rgba(255,215,0,0.28)',
    citBorder: '#C9A84C',
  },
  imperial: {
    light: '#F8F4E8',
    dark:  '#2CA6A4',
    selected: 'rgba(212,175,55,0.65)',
    lastMove: 'rgba(212,175,55,0.30)',
    citBorder: '#D4AF37',
  },
};

function applyBoardThemeColors(theme) {
  const palette = BOARD_THEMES[theme] || BOARD_THEMES.temur;

  if (typeof CLR !== 'undefined' && CLR) {
    CLR.light     = palette.light;
    CLR.dark      = palette.dark;
    CLR.selected  = palette.selected;
    CLR.lastMove  = palette.lastMove;
    CLR.citBorder = palette.citBorder;
  }

  if (typeof drawBoard === 'function' && gameState?.board) {
    try { drawBoard(); } catch (e) { /* taxta hali tayyor bo'lmasligi mumkin */ }
  }
  if (typeof drawPuzzleBoard === 'function' && gameState?.board) {
    try { drawPuzzleBoard(); } catch (e) { /* silent */ }
  }
}

// Sahifa yuklanganda saqlangan temani qo'llaymiz
document.addEventListener('DOMContentLoaded', () => {
  setTheme(getCurrentTheme());
});

// ── TARJIMALARNI HTML GA QOʻLLASH ─────────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    if (translation) el.textContent = translation;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = t(key);
    if (translation) el.placeholder = translation;
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = t(key);
    if (translation) el.title = translation;
  });
}

// Til o'zgarganda tarjimalarni qayta qo'llash
document.addEventListener('langChanged', () => {
  applyTranslations();
  
  const onlineSection = document.getElementById('online');
  if (onlineSection && !onlineSection.classList.contains('hidden')) {
    loadLeaderboard();
  }
});

// Sahifa yuklanganda ham qo'llash
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  setTheme(getCurrentTheme());
});

// ============================================================
//  TARJIMA TIZIMI — applyTranslations()
//  app.js ning OXIRIGA qo'shing (setTheme blokidan keyin)
// ============================================================

function applyTranslations() {
  // 1. data-i18n — textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val && val !== key) el.textContent = val;
  });

  // 2. data-i18n-title — title atributi
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = t(key);
    if (val && val !== key) el.title = val;
  });

  // 3. data-i18n-placeholder — placeholder atributi
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val && val !== key) el.placeholder = val;
  });

  // 4. Til nomi (nav dagi)
  const langNameEl = document.getElementById('current-lang-name');
  if (langNameEl) langNameEl.textContent = t('langName');

  // 5. Site nomi
  const siteNameEl = document.getElementById('nav-site-name');
  if (siteNameEl) siteNameEl.textContent = t('siteName');

  // 6. Sahifa title
  document.title = t('siteName') || 'Amir Temur Shaxmati';

  // 7. Tutorial qayta chizilsin (agar ochiq bo'lsa)
  const tutSection = document.getElementById('tutorial');
  if (tutSection && !tutSection.classList.contains('hidden')) {
    if (typeof initTutorial === 'function') initTutorial();
  }
}

// ── SAHIFA YUKLANGANDA ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
});

// ── TIL O'ZGARGANDA ─────────────────────────────────────────
document.addEventListener('langChanged', () => {
  applyTranslations();
});