// ============================================================
//  PRESENCE — onlayn foydalanuvchilar sonini ko'rsatish
// ============================================================
//
// MUHIM: bu funksiya avval to'g'ridan-to'g'ri DOMContentLoaded'da
// chaqirilardi va currentUser'ni o'sha zahoti o'qirdi. Lekin
// currentUser auth.js'da ASINXRON (await loadCurrentUser()) tarzda
// o'rnatiladi — presence.js undan TEZROQ ishga tushib qolar, shu
// sababli currentUser hali `null` bo'lib, foydalanuvchi o'z haqiqiy
// ID'si o'rniga tasodifiy "mehmon" ID bilan onlayn deb belgilanardi.
// Natijada matchmaking'dagi isUserOnline() tekshiruvi HAR DOIM
// false qaytarardi va "qidirilmoqda" holatida to'xtab qolardi.
//
// Endi presence faqat auth tekshiruvi TUGAGANDAN keyin ('authReady'
// hodisasi, auth.js'da yuboriladi) ishga tushadi, shuningdek
// tizimga kirish/chiqishda ('userSignedIn'/'userSignedOut') qayta
// ro'yxatdan o'tkaziladi.
// ============================================================

let sitePresenceChannel = null;

function initPresence(userOverride) {
  const user        = userOverride || currentUser;
  const presenceId  = user?.id || crypto.randomUUID();
  const nickname    = user?.user_metadata?.nickname || currentProfile?.nickname || 'Mehmon';

  // Eski kanal bo'lsa (masalan, kirish/chiqishdan keyin qayta
  // chaqirilganda), avval undan chiqamiz — aks holda eski ID bilan
  // "arvoh" yozuv saqlanib qolaveradi.
  if (sitePresenceChannel) {
    try { sitePresenceChannel.unsubscribe(); } catch (e) {}
    sitePresenceChannel = null;
  }

  sitePresenceChannel = getSb().channel('site-online-users', {
    config: {
      presence: { key: presenceId },
    },
  });

  sitePresenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = sitePresenceChannel.presenceState();
      const count = Object.keys(state).length;
      updateOnlineCount(count);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await sitePresenceChannel.track({
          nickname,
          online_at: new Date().toISOString(),
        });
      }
    });
}

function updateOnlineCount(count) {
  const el = document.getElementById('online-count');
  if (el) el.textContent = count;
}

// ============================================================
//  Boshqa modullar (masalan matchmaking) uchun: berilgan
//  foydalanuvchi ID hozir haqiqatan ham saytda onlaynmi?
//  Bu presence "key" sifatida foydalanuvchi ID (kirgan bo'lsa)
//  ishlatilgani uchun ishonchli tekshiruv beradi — navbatda
//  qolib ketgan, lekin brauzeri yopilgan "arvoh" foydalanuvchilar
//  bilan mos kelib qolmaslik uchun ishlatiladi.
// ============================================================
function isUserOnline(userId) {
  if (!sitePresenceChannel || !userId) return false;
  const state = sitePresenceChannel.presenceState();
  return Object.prototype.hasOwnProperty.call(state, userId);
}
window.isUserOnline = isUserOnline;

// Auth tekshiruvi ANIQ tugagandan keyin ishga tushirish (race yo'q,
// chunki bu listener DOMContentLoaded'dan ancha oldin — skript
// yuklanishi paytidayoq — ro'yxatdan o'tadi).
document.addEventListener('authReady', () => initPresence());
// Kirish/chiqishda haqiqiy ID bilan qayta ro'yxatdan o'tish. Bu yerda
// currentUser global o'zgaruvchisiga emas, balki hodisa bilan
// birga kelgan foydalanuvchi obyektiga tayanamiz — chunki
// currentUser shu tobda hali yangilanmagan bo'lishi mumkin.
document.addEventListener('userSignedIn', (e) => initPresence(e.detail));
document.addEventListener('userSignedOut', () => initPresence(null));

// Zaxira: agar biror sababga ko'ra 'authReady' umuman yuborilmasa
// (masalan, auth.js versiyasi eski), baribir bir necha soniyadan
// keyin currentUser bilan urinib ko'ramiz — hech bo'lmasa butunlay
// ishlamay qolmasin.
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { if (!sitePresenceChannel) initPresence(); }, 3000);
});