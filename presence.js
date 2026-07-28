// ============================================================
//  PRESENCE — onlayn foydalanuvchilar sonini ko'rsatish
// ============================================================

let sitePresenceChannel = null;

function initPresence() {
  const presenceId = currentUser?.id || crypto.randomUUID();
  const nickname   = currentUser?.user_metadata?.nickname || 'Mehmon';

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

document.addEventListener('DOMContentLoaded', initPresence);