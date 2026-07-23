// ============================================================
//  AMIR TEMUR SHAXMATI — auth.js
//  Ro'yhatdan o'tish, login, Google OAuth, profil boshqaruvi
// ============================================================

let currentUser    = null;
let currentProfile = null;

// ── DAVLATLAR RO'YXATI ────────────────────────────────────────
const COUNTRIES = [
  { code: 'UZ', flag: '🇺🇿', name: { uz: "O'zbekiston", en: 'Uzbekistan', ru: 'Узбекистан', tr: 'Özbekistan', kk: 'Өзбекстан', tg: 'Ӯзбекистон', ky: 'Өзбекстан', tk: 'Özbegistan' } },
  { code: 'RU', flag: '🇷🇺', name: { uz: 'Rossiya', en: 'Russia', ru: 'Россия', tr: 'Rusya', kk: 'Ресей', tg: 'Русия', ky: 'Россия', tk: 'Russiýa' } },
  { code: 'KZ', flag: '🇰🇿', name: { uz: 'Qozogʻiston', en: 'Kazakhstan', ru: 'Казахстан', tr: 'Kazakistan', kk: 'Қазақстан', tg: 'Қазоқистон', ky: 'Казакстан', tk: 'Gazagystan' } },
  { code: 'KG', flag: '🇰🇬', name: { uz: 'Qirgʻiziston', en: 'Kyrgyzstan', ru: 'Кыргызстан', tr: 'Kırgızistan', kk: 'Қырғызстан', tg: 'Қирғизистон', ky: 'Кыргызстан', tk: 'Gyrgyzystan' } },
  { code: 'TJ', flag: '🇹🇯', name: { uz: 'Tojikiston', en: 'Tajikistan', ru: 'Таджикистан', tr: 'Tacikistan', kk: 'Тәжікстан', tg: 'Тоҷикистон', ky: 'Тажикстан', tk: 'Täjigistan' } },
  { code: 'TM', flag: '🇹🇲', name: { uz: 'Turkmaniston', en: 'Turkmenistan', ru: 'Туркменистан', tr: 'Türkmenistan', kk: 'Түркіменстан', tg: 'Туркманистон', ky: 'Түркмөнстан', tk: 'Türkmenistan' } },
  { code: 'TR', flag: '🇹🇷', name: { uz: 'Turkiya', en: 'Turkey', ru: 'Турция', tr: 'Türkiye', kk: 'Түркия', tg: 'Туркия', ky: 'Түркия', tk: 'Türkiýe' } },
  { code: 'AF', flag: '🇦🇫', name: { uz: 'Afgʻoniston', en: 'Afghanistan', ru: 'Афганистан', tr: 'Afganistan', kk: 'Ауғанстан', tg: 'Афғонистон', ky: 'Афганистан', tk: 'Owganystan' } },
  { code: 'AZ', flag: '🇦🇿', name: { uz: 'Ozarbayjon', en: 'Azerbaijan', ru: 'Азербайджан', tr: 'Azerbaycan', kk: 'Әзербайжан', tg: 'Озарбойҷон', ky: 'Азербайжан', tk: 'Azerbaýjan' } },
  { code: 'CN', flag: '🇨🇳', name: { uz: 'Xitoy', en: 'China', ru: 'Китай', tr: 'Çin', kk: 'Қытай', tg: 'Чин', ky: 'Кытай', tk: 'Hytaý' } },
  { code: 'DE', flag: '🇩🇪', name: { uz: 'Germaniya', en: 'Germany', ru: 'Германия', tr: 'Almanya', kk: 'Германия', tg: 'Германия', ky: 'Германия', tk: 'Germaniýa' } },
  { code: 'FR', flag: '🇫🇷', name: { uz: 'Fransiya', en: 'France', ru: 'Франция', tr: 'Fransa', kk: 'Франция', tg: 'Фаронса', ky: 'Франция', tk: 'Fransiýa' } },
  { code: 'GB', flag: '🇬🇧', name: { uz: 'Buyuk Britaniya', en: 'United Kingdom', ru: 'Великобритания', tr: 'Birleşik Krallık', kk: 'Ұлыбритания', tg: 'Британияи Кабир', ky: 'Улуу Британия', tk: 'Beýik Britaniýa' } },
  { code: 'US', flag: '🇺🇸', name: { uz: 'AQSH', en: 'USA', ru: 'США', tr: 'ABD', kk: 'АҚШ', tg: 'ИМА', ky: 'АКШ', tk: 'ABŞ' } },
  { code: 'IR', flag: '🇮🇷', name: { uz: 'Eron', en: 'Iran', ru: 'Иран', tr: 'İran', kk: 'Иран', tg: 'Эрон', ky: 'Иран', tk: 'Eýran' } },
  { code: 'PK', flag: '🇵🇰', name: { uz: 'Pokiston', en: 'Pakistan', ru: 'Пакистан', tr: 'Pakistan', kk: 'Пәкістан', tg: 'Покистон', ky: 'Пакистан', tk: 'Päkistan' } },
  { code: 'IN', flag: '🇮🇳', name: { uz: 'Hindiston', en: 'India', ru: 'Индия', tr: 'Hindistan', kk: 'Үндістан', tg: 'Ҳиндустон', ky: 'Индия', tk: 'Hindistan' } },
  { code: 'OTHER', flag: '🌍', name: { uz: 'Boshqa', en: 'Other', ru: 'Другое', tr: 'Diğer', kk: 'Басқа', tg: 'Дигар', ky: 'Башка', tk: 'Beýleki' } },
];

function getCountryName(code) {
  const c = COUNTRIES.find(x => x.code === code);
  if (!c) return code;
  return (c.flag + ' ' + (c.name[currentLang] || c.name.en));
}

// ── AUTH MODAL ────────────────────────────────────────────────
function showAuthModal(tab = 'login') {
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = createAuthModal();
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');
  switchAuthTab(tab);
}

function hideAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function createAuthModal() {
  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'modal-overlay';

  // Til options
  const langOpts = Object.keys(TRANSLATIONS).map(code =>
    `<option value="${code}" ${code === (currentLang || 'uz') ? 'selected' : ''}>
      ${TRANSLATIONS[code].langName}
    </option>`
  ).join('');

  // Davlat options
  const countryOpts = COUNTRIES.map(c =>
    `<option value="${c.code}">${c.flag} ${c.name[currentLang] || c.name.en}</option>`
  ).join('');

  modal.innerHTML = `
    <div class="modal-box auth-box">
      <button class="modal-close" onclick="hideAuthModal()">✕</button>

      <div class="auth-logo">
        <span class="logo-icon">♞</span>
        <h2 class="auth-title">Amir Temur Shaxmati</h2>
      </div>

      <!-- Tablar -->
      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login"  onclick="switchAuthTab('login')">Kirish</button>
        <button class="auth-tab"        id="tab-signup" onclick="switchAuthTab('signup')">Ro'yhatdan o'tish</button>
      </div>

      <!-- ══ LOGIN ══ -->
      <div id="form-login" class="auth-form">

        <!-- Google -->
        <button class="btn-google" onclick="handleGoogleLogin()">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google orqali kirish
        </button>

        <div class="auth-divider"><span>yoki</span></div>

        <div class="form-group">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="email@example.com" autocomplete="email"/>
        </div>
        <div class="form-group">
          <label>Parol</label>
          <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password"/>
        </div>
        <div class="auth-error hidden" id="login-error"></div>
        <button class="btn btn-primary auth-submit" onclick="handleLogin()">
          <span id="login-btn-text">Kirish</span>
        </button>
        <p class="auth-switch">
          Hisobingiz yo'qmi?
          <a href="#" onclick="switchAuthTab('signup')">Ro'yhatdan o'ting</a>
        </p>
      </div>

      <!-- ══ SIGNUP ══ -->
      <div id="form-signup" class="auth-form hidden">

        <!-- Google -->
        <button class="btn-google" onclick="handleGoogleLogin()">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google orqali ro'yhatdan o'tish
        </button>

        <div class="auth-divider"><span>yoki</span></div>

        <div class="form-group">
          <label>Nickname <span class="hint">(3-20 harf, raqam, _)</span></label>
          <div class="input-with-check">
            <input type="text" id="signup-nickname" placeholder="temur_chess_fan"
              oninput="checkNickname(this.value)" autocomplete="username"/>
            <span class="nick-status" id="nick-status"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="signup-email" placeholder="email@example.com" autocomplete="email"/>
        </div>
        <div class="form-group">
          <label>Parol <span class="hint">(kamida 6 belgi)</span></label>
          <input type="password" id="signup-password" placeholder="••••••••" autocomplete="new-password"/>
        </div>
        <div class="form-group">
          <label>Parolni tasdiqlang</label>
          <input type="password" id="signup-confirm" placeholder="••••••••" autocomplete="new-password"/>
        </div>

        <!-- TIL TANLASH -->
        <div class="form-group">
          <label>🌐 Til / Language</label>
          <select id="signup-lang" class="auth-select">
            ${langOpts}
          </select>
        </div>

        <!-- DAVLAT TANLASH -->
        <div class="form-group">
          <label>📍 Davlat / Country</label>
          <select id="signup-country" class="auth-select">
            ${countryOpts}
          </select>
        </div>

        <div class="auth-error hidden" id="signup-error"></div>
        <button class="btn btn-primary auth-submit" onclick="handleSignup()">
          <span id="signup-btn-text">Ro'yhatdan o'tish</span>
        </button>
        <p class="auth-switch">
          Hisobingiz bormi?
          <a href="#" onclick="switchAuthTab('login')">Kiring</a>
        </p>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) hideAuthModal(); });
  return modal;
}

function switchAuthTab(tab) {
  document.getElementById('form-login') ?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-signup')?.classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tab-login')  ?.classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup') ?.classList.toggle('active', tab === 'signup');
}

// ── GOOGLE LOGIN ──────────────────────────────────────────────
async function handleGoogleLogin() {
  try {
    const { error } = await getSb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (e) {
    showToast('Google bilan kirishda xato: ' + e.message, 'error');
  }
}

// Google qaytgandan keyin profil yaratish
async function handleGoogleCallback() {
  try {
    const { data: { session } } = await getSb().auth.getSession();
    if (!session) return;

    const user = session.user;
    const existing = await getProfile(user.id);
    if (existing) return; // Profil allaqachon bor

    // Yangi Google foydalanuvchi — nickname modal ko'rsat
    showGoogleProfileSetup(user);
  } catch (e) {
    console.error('Google callback xato:', e);
  }
}

function showGoogleProfileSetup(user) {
  const langOpts = Object.keys(TRANSLATIONS).map(code =>
    `<option value="${code}" ${code === (currentLang || 'uz') ? 'selected' : ''}>
      ${TRANSLATIONS[code].langName}
    </option>`
  ).join('');

  const countryOpts = COUNTRIES.map(c =>
    `<option value="${c.code}">${c.flag} ${c.name[currentLang] || c.name.en}</option>`
  ).join('');

  // Default nickname: Google display name dan
  const defaultNick = (user.user_metadata?.full_name || user.email?.split('@')[0] || '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 20);

  const setupModal = document.createElement('div');
  setupModal.id = 'google-setup-modal';
  setupModal.className = 'modal-overlay';
  setupModal.innerHTML = `
    <div class="modal-box auth-box">
      <div class="auth-logo">
        <span class="logo-icon">♞</span>
        <h2 class="auth-title">Profilni sozlash</h2>
        <p style="color:rgba(255,255,255,0.5);font-size:.85rem;margin-top:.25rem">
          Bir marta to'ldiring
        </p>
      </div>

      <div class="auth-form">
        <div class="form-group">
          <label>Nickname <span class="hint">(3-20 harf, raqam, _)</span></label>
          <div class="input-with-check">
            <input type="text" id="gsetup-nickname"
              value="${defaultNick}"
              oninput="checkNickname(this.value)" autocomplete="username"/>
            <span class="nick-status" id="nick-status"></span>
          </div>
        </div>

        <div class="form-group">
          <label>🌐 Til / Language</label>
          <select id="gsetup-lang" class="auth-select">${langOpts}</select>
        </div>

        <div class="form-group">
          <label>📍 Davlat / Country</label>
          <select id="gsetup-country" class="auth-select">${countryOpts}</select>
        </div>

        <div class="auth-error hidden" id="gsetup-error"></div>

        <button class="btn btn-primary auth-submit" onclick="saveGoogleProfile('${user.id}')">
          <span id="gsetup-btn-text">Saqlash</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(setupModal);
}

async function saveGoogleProfile(userId) {
  const nickname = document.getElementById('gsetup-nickname')?.value.trim();
  const lang     = document.getElementById('gsetup-lang')?.value || 'uz';
  const country  = document.getElementById('gsetup-country')?.value || 'UZ';
  const btnText  = document.getElementById('gsetup-btn-text');

  if (!nickname) return showGoogleSetupError('Nickname kiriting!');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname))
    return showGoogleSetupError('Nickname 3-20 ta harf/raqam/_');

  btnText.textContent = 'Saqlanmoqda...';
  try {
    const { error } = await getSb().from('profiles').insert({
      id: userId,
      nickname,
      lang,
      country,
      elo: 1200,
      puzzle_elo: 1000,
      games_played: 0,
      wins: 0,
      losses: 0,
      draws: 0
    });
    if (error) throw error;

    // Til ham o'zgartirilsin
    if (typeof setLang === 'function') setLang(lang);

    document.getElementById('google-setup-modal')?.remove();
    await loadCurrentUser();
    updateNavbar();
    showToast('Xush kelibsiz! 🎉', 'success');
  } catch (e) {
    showGoogleSetupError(e.code === '23505' ? 'Bu nickname band!' : e.message);
    btnText.textContent = 'Saqlash';
  }
}

function showGoogleSetupError(msg) {
  const el = document.getElementById('gsetup-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

// ── NICKNAME TEKSHIRUVI ───────────────────────────────────────
let nickCheckTimer = null;
async function checkNickname(val) {
  const status = document.getElementById('nick-status');
  if (!status) return;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
    status.textContent = val.length < 3 ? '' : '✗ Noto\'g\'ri format';
    status.className = 'nick-status error';
    return;
  }
  status.textContent = '...';
  status.className = 'nick-status checking';
  clearTimeout(nickCheckTimer);
  nickCheckTimer = setTimeout(async () => {
    try {
      const { data } = await getSb().from('profiles').select('nickname').eq('nickname', val).single();
      if (data) {
        status.textContent = '✗ Band';
        status.className = 'nick-status error';
      } else {
        status.textContent = '✓ Bo\'sh';
        status.className = 'nick-status ok';
      }
    } catch { status.textContent = '✓ Bo\'sh'; status.className = 'nick-status ok'; }
  }, 500);
}

// ── LOGIN ─────────────────────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btnText  = document.getElementById('login-btn-text');

  if (!email || !password) return showAuthError('login', 'Email va parol kiriting!');

  btnText.textContent = 'Kirilmoqda...';
  try {
    await signIn(email, password);
    hideAuthModal();
    await loadCurrentUser();
    updateNavbar();
  } catch (e) {
    showAuthError('login', e.message === 'Invalid login credentials'
      ? 'Email yoki parol noto\'g\'ri!' : e.message);
  } finally {
    btnText.textContent = 'Kirish';
  }
}

// ── SIGNUP ────────────────────────────────────────────────────
async function handleSignup() {
  const nickname = document.getElementById('signup-nickname')?.value.trim();
  const email    = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value;
  const confirm  = document.getElementById('signup-confirm')?.value;
  const lang     = document.getElementById('signup-lang')?.value || 'uz';
  const country  = document.getElementById('signup-country')?.value || 'UZ';
  const btnText  = document.getElementById('signup-btn-text');

  if (!nickname || !email || !password)
    return showAuthError('signup', 'Barcha maydonlarni to\'ldiring!');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname))
    return showAuthError('signup', 'Nickname 3-20 ta harf/raqam/_');
  if (password.length < 6)
    return showAuthError('signup', 'Parol kamida 6 belgi bo\'lsin!');
  if (password !== confirm)
    return showAuthError('signup', 'Parollar mos emas!');

  btnText.textContent = 'Ro\'yhatdan o\'tilmoqda...';
  try {
    // signUp — supabase.js dagi funksiya, metadata bilan
    const { data, error } = await getSb().auth.signUp({
      email,
      password,
      options: {
        data: { nickname, lang, country }
      }
    });
    if (error) throw error;

    // Profil yaratish (agar trigger bo'lmasa)
    if (data.user) {
      try {
        await getSb().from('profiles').insert({
          id: data.user.id,
          nickname,
          lang,
          country,
          elo: 1200,
          puzzle_elo: 1000,
          games_played: 0,
          wins: 0,
          losses: 0,
          draws: 0
        });
      } catch (profileErr) {
        // Trigger allaqachon yaratgan bo'lishi mumkin — ignore
        console.log('Profile insert:', profileErr.message);
      }
    }

    // Til o'zgartirish
    if (typeof setLang === 'function') setLang(lang);

    showAuthSuccess('signup', 'Emailingizni tasdiqlang! Keyin kiring.');
  } catch (e) {
    showAuthError('signup', e.message);
  } finally {
    btnText.textContent = 'Ro\'yhatdan o\'tish';
  }
}

function showAuthError(form, msg) {
  const el = document.getElementById(`${form}-error`);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); el.style.color = ''; }
}

function showAuthSuccess(form, msg) {
  const el = document.getElementById(`${form}-error`);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); el.style.color = '#4ade80'; }
}

// ── FOYDALANUVCHI YUKLASH ─────────────────────────────────────
async function loadCurrentUser() {
  try {
    const user = await getCurrentUser();
    if (!user) { currentUser = null; currentProfile = null; return; }
    currentUser    = user;
    currentProfile = await getProfile(user.id);

    if (currentProfile?.is_banned) {
      await signOut();
      currentUser = null; currentProfile = null;
      showBanModal(); return;
    }

    // Foydalanuvchi tili saqlangan bo'lsa — o'rnatamiz
    if (currentProfile?.lang && typeof setLang === 'function') {
      setLang(currentProfile.lang);
    }
  } catch { currentUser = null; currentProfile = null; }
}

// ── NAVBAR YANGILASH ──────────────────────────────────────────
function updateNavbar() {
  const loginBtn = document.getElementById('nav-login-btn');
  const userMenu = document.getElementById('nav-user-menu');
  const userNick = document.getElementById('nav-user-nick');
  const avatarEl = document.getElementById('nav-avatar');

  if (currentProfile) {
    loginBtn?.classList.add('hidden');
    userMenu?.classList.remove('hidden');
    if (userNick) userNick.textContent = currentProfile.nickname;
    if (avatarEl) {
      if (currentProfile.avatar_url) {
        avatarEl.innerHTML = `<img src="${currentProfile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      } else {
        avatarEl.textContent = currentProfile.nickname[0].toUpperCase();
      }
    }
    checkPendingRequests();
  } else {
    loginBtn?.classList.remove('hidden');
    userMenu?.classList.add('hidden');
  }

  const adminLink = document.getElementById('nav-admin-link');
  if (adminLink) {
    adminLink.classList.toggle('hidden', !currentProfile?.is_admin);
    adminLink.style.display = '';
  }
}

// ── DO'STLIK SO'ROVLARI ───────────────────────────────────────
async function checkPendingRequests() {
  try {
    const requests = await getPendingRequests();
    const badge = document.getElementById('friend-badge');
    if (badge) {
      badge.textContent = requests.length;
      badge.classList.toggle('hidden', requests.length === 0);
    }
  } catch {}
}

// ── REAL-TIME ─────────────────────────────────────────────────
let realtimeChannel = null;
function setupRealtimeNotifications() {
  if (!currentUser || !getSb()) return;
  if (realtimeChannel) { getSb().removeChannel(realtimeChannel); realtimeChannel = null; }
  try {
    realtimeChannel = getSb()
      .channel(`notify-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'friendships', filter: `receiver_id=eq.${currentUser.id}`
      }, async () => {
        await checkPendingRequests();
        showToast("Yangi do'stlik so'rovi keldi! 🤝");
      })
      .subscribe();
  } catch (e) { console.warn('Real-time ulanmadi:', e.message); }
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('userSignedIn', async () => {
  await loadCurrentUser();
  updateNavbar();
  setupRealtimeNotifications();
  // Google yangi foydalanuvchi bo'lsa — profil setup
  if (currentUser && !currentProfile) {
    showGoogleProfileSetup(currentUser);
  }
});
document.addEventListener('userSignedOut', () => {
  currentUser = null; currentProfile = null; updateNavbar();
});

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('nav-login-btn')
    ?.addEventListener('click', () => showAuthModal('login'));
  document.getElementById('nav-search-btn')
    ?.addEventListener('click', () => {
      if (typeof openSearchPanel === 'function') openSearchPanel();
    });

  // Dropdown yopish
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('nav-user-dropdown');
    if (dd && !dd.contains(e.target) &&
        !document.getElementById('nav-avatar')?.contains(e.target) &&
        !document.getElementById('nav-user-nick')?.contains(e.target)) {
      dd.classList.remove('open');
    }
  });

  await loadCurrentUser();
  updateNavbar();
  if (currentUser) setupRealtimeNotifications();

  // Google OAuth callback — URL da access_token bo'lsa
  if (window.location.hash.includes('access_token') ||
      window.location.search.includes('code=')) {
    await handleGoogleCallback();
  }
});

// ── BAN MODAL ─────────────────────────────────────────────────
function showBanModal() {
  const existing = document.getElementById('ban-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'ban-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center;max-width:400px">
      <div style="font-size:3rem;margin-bottom:1rem">⛔</div>
      <h3 class="modal-title" style="color:#e05555">Hisob bloklangan</h3>
      <p style="color:rgba(255,255,255,0.6);margin:.75rem 0 1.5rem;line-height:1.6">
        Sizning hisobingiz administrator tomonidan bloklangan.<br>
        Murojaat uchun:
        <a href="mailto:temurshaxmati@gmail.com" style="color:#C9A84C">temurshaxmati@gmail.com</a>
      </p>
      <button class="btn btn-primary" onclick="document.getElementById('ban-modal').remove()">OK</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── AVATAR UPLOAD ─────────────────────────────────────────────
function triggerAvatarUpload() {
  if (!currentUser) return;
  document.getElementById('avatarFileInput')?.click();
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Rasm 2MB dan kichik bo\'lishi kerak', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Faqat rasm fayl yuklang', 'error'); return; }

  showToast('Yuklanmoqda...', 'info');
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUser.id}/avatar.${fileExt}`;
    const { error } = await getSb().storage.from('avatars').upload(filePath, file, { upsert: true });
    if (error) throw error;

    const { data } = getSb().storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = data.publicUrl + '?t=' + Date.now();
    await getSb().from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
    currentProfile.avatar_url = avatarUrl;

    const display = document.getElementById('profile-avatar-display');
    if (display) display.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    updateNavbar();
    showToast('Profil surati yangilandi! ✓', 'success');
  } catch (e) { showToast('Xato: ' + e.message, 'error'); }
}