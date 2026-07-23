// ============================================================
//  AMIR TEMUR SHAXMATI — social.js
//  Qidiruv, do'stlik, profil ko'rish
// ============================================================

// ── QIDIRUV PANELI ───────────────────────────────────────────
function openSearchPanel() {
  if (!currentUser) { showAuthModal('login'); return; }
  let panel = document.getElementById('search-panel');
  if (!panel) { panel = createSearchPanel(); document.body.appendChild(panel); }
  panel.classList.remove('hidden');
  document.getElementById('search-input')?.focus();
}

function closeSearchPanel() {
  document.getElementById('search-panel')?.classList.add('hidden');
}

function createSearchPanel() {
  const panel = document.createElement('div');
  panel.id = 'search-panel';
  panel.className = 'side-drawer';
  panel.innerHTML = `
    <div class="drawer-header">
      <h3>Foydalanuvchi qidirish</h3>
      <button class="drawer-close" onclick="closeSearchPanel()">✕</button>
    </div>
    <div class="search-input-wrap">
      <span class="search-icon">🔍</span>
      <input type="text" id="search-input" placeholder="Nickname kiriting..."
        oninput="handleSearch(this.value)" autocomplete="off"/>
    </div>
    <div id="search-results" class="search-results">
      <p class="search-hint">Kamida 2 ta harf kiriting</p>
    </div>
  `;
  return panel;
}

let searchTimer = null;
async function handleSearch(query) {
  clearTimeout(searchTimer);
  const results = document.getElementById('search-results');
  if (!results) return;
  if (query.length < 2) {
    results.innerHTML = '<p class="search-hint">Kamida 2 ta harf kiriting</p>';
    return;
  }
  results.innerHTML = '<p class="search-hint">Qidirilmoqda...</p>';
  searchTimer = setTimeout(async () => {
    try {
      const users = await searchUsers(query);
      if (!users.length) {
        results.innerHTML = '<p class="search-hint">Topilmadi</p>'; return;
      }
      results.innerHTML = '';
      for (const u of users) {
        if (u.id === currentUser?.id) continue;
        const status = await getFriendshipStatus(u.id);
        results.appendChild(createUserCard(u, status));
      }
    } catch (e) {
      results.innerHTML = `<p class="search-hint error">${e.message}</p>`;
    }
  }, 400);
}

function createUserCard(user, friendship) {
  const card = document.createElement('div');
  card.className = 'user-card';

  let actionBtn = '';
  if (!friendship) {
    actionBtn = `<button class="btn-friend-req" onclick="sendRequest('${user.id}', this)">
      🤝 Do'stlashish
    </button>`;
  } else if (friendship.status === 'pending' && friendship.sender_id === currentUser?.id) {
    actionBtn = `<button class="btn-friend-pending" disabled>⏳ Kutilmoqda</button>`;
  } else if (friendship.status === 'pending') {
    actionBtn = `
      <button class="btn-friend-accept" onclick="acceptRequest('${friendship.id}', this)">✓ Qabul</button>
      <button class="btn-friend-reject" onclick="rejectRequest('${friendship.id}', this)">✗ Rad</button>`;
  } else if (friendship.status === 'accepted') {
    actionBtn = `<button class="btn-friend-added" disabled>✓ Do'st</button>`;
  }

  card.innerHTML = `
    <div class="user-card-avatar">${user.nickname[0].toUpperCase()}</div>
    <div class="user-card-info">
      <div class="user-card-nick">${escapeHtml(user.nickname)}</div>
      <div class="user-card-stats">
        <span class="stat-w">🏆 ${user.wins||0}</span>
        <span class="stat-l">💔 ${user.losses||0}</span>
      </div>
    </div>
    <div class="user-card-actions">${actionBtn}</div>
  `;
  card.querySelector('.user-card-avatar, .user-card-nick')?.addEventListener('click',
    () => openProfileModal(user.id));
  return card;
}

// ── DO'STLIK AMALLARI ─────────────────────────────────────────
async function sendRequest(receiverId, btn) {
  try {
    await sendFriendRequest(receiverId);
    if (btn) { btn.textContent = '⏳ Kutilmoqda'; btn.disabled = true; btn.className = 'btn-friend-pending'; }
    showToast("So'rov yuborildi! 🤝");
  } catch (e) { showToast(e.message, 'error'); }
}

async function acceptRequest(friendshipId, btn) {
  try {
    await respondFriendRequest(friendshipId, true);
    if (btn) { btn.closest('.user-card-actions').innerHTML = "<button class='btn-friend-added' disabled>✓ Do'st</button>"; }
    showToast("Do'st qo'shildi! 🎉");
    await checkPendingRequests();
  } catch (e) { showToast(e.message, 'error'); }
}

async function rejectRequest(friendshipId, btn) {
  try {
    await respondFriendRequest(friendshipId, false);
    btn?.closest('.user-card')?.remove();
    showToast('Rad etildi.');
    await checkPendingRequests();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── DO'STLAR PANELI ───────────────────────────────────────────
async function openFriendsPanel() {
  if (!currentUser) { showAuthModal('login'); return; }
  let panel = document.getElementById('friends-panel');
  if (!panel) { panel = createFriendsPanel(); document.body.appendChild(panel); }
  panel.classList.remove('hidden');
  await loadFriendsPanel();
}

function closeFriendsPanel() {
  document.getElementById('friends-panel')?.classList.add('hidden');
}

function createFriendsPanel() {
  const panel = document.createElement('div');
  panel.id = 'friends-panel';
  panel.className = 'side-drawer';
  panel.innerHTML = `
    <div class="drawer-header">
      <h3>Do'stlarim</h3>
      <button class="drawer-close" onclick="closeFriendsPanel()">✕</button>
    </div>
    <div class="friends-tabs">
      <button class="ftab active" id="ftab-friends"   onclick="switchFTab('friends')">Do'stlar</button>
      <button class="ftab"        id="ftab-requests"  onclick="switchFTab('requests')">
        So'rovlar <span class="friend-badge hidden" id="friend-badge">0</span>
      </button>
    </div>
    <div id="friends-list-content"   class="friends-content"></div>
    <div id="requests-list-content"  class="friends-content hidden"></div>
  `;
  return panel;
}

function switchFTab(tab) {
  document.getElementById('friends-list-content') ?.classList.toggle('hidden', tab!=='friends');
  document.getElementById('requests-list-content')?.classList.toggle('hidden', tab!=='requests');
  document.getElementById('ftab-friends')  ?.classList.toggle('active', tab==='friends');
  document.getElementById('ftab-requests') ?.classList.toggle('active', tab==='requests');
}

async function loadFriendsPanel() {
  const friendsEl   = document.getElementById('friends-list-content');
  const requestsEl  = document.getElementById('requests-list-content');
  if (!friendsEl || !requestsEl) return;

  friendsEl.innerHTML  = '<p class="search-hint">Yuklanmoqda...</p>';
  requestsEl.innerHTML = '<p class="search-hint">Yuklanmoqda...</p>';

  try {
    const [friends, requests] = await Promise.all([getFriends(), getPendingRequests()]);

    if (!friends.length) {
      friendsEl.innerHTML = '<p class="search-hint">Hali do\'stlar yo\'q.<br>Qidiruv orqali do\'stlashing!</p>';
    } else {
      friendsEl.innerHTML = '';
      friends.forEach(f => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
          <div class="user-card-avatar">${f.friend_nickname[0].toUpperCase()}</div>
          <div class="user-card-info">
            <div class="user-card-nick">${escapeHtml(f.friend_nickname)}</div>
          </div>
          <div class="user-card-actions">
            <button class="btn-friend-remove" onclick="removeF('${f.id}', this)">✕</button>
          </div>`;
        card.querySelector('.user-card-avatar, .user-card-nick')?.addEventListener('click',
          () => openProfileModal(f.friend_id));
        friendsEl.appendChild(card);
      });
    }

    if (!requests.length) {
      requestsEl.innerHTML = '<p class="search-hint">Kutilayotgan so\'rovlar yo\'q</p>';
    } else {
      requestsEl.innerHTML = '';
      requests.forEach(r => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
          <div class="user-card-avatar">${r.sender_nickname[0].toUpperCase()}</div>
          <div class="user-card-info">
            <div class="user-card-nick">${escapeHtml(r.sender_nickname)}</div>
            <div class="user-card-time">${timeAgo(r.created_at)}</div>
          </div>
          <div class="user-card-actions">
            <button class="btn-friend-accept" onclick="acceptRequest('${r.id}', this)">✓</button>
            <button class="btn-friend-reject" onclick="rejectRequest('${r.id}', this)">✗</button>
          </div>`;
        requestsEl.appendChild(card);
      });
    }

    const badge = document.getElementById('friend-badge');
    if (badge) { badge.textContent = requests.length; badge.classList.toggle('hidden', !requests.length); }

  } catch (e) { friendsEl.innerHTML = `<p class="search-hint error">${e.message}</p>`; }
}

async function removeF(friendshipId, btn) {
  if (!confirm("Do'stlikni bekor qilmoqchimisiz?")) return;
  try {
    await removeFriend(friendshipId);
    btn?.closest('.user-card')?.remove();
    showToast("Do'stlikdan chiqildi.");
  } catch (e) { showToast(e.message, 'error'); }
}

// ── PROFIL MODALI ─────────────────────────────────────────────
async function openProfileModal(userId) {
  let modal = document.getElementById('profile-modal');
  if (!modal) { modal = createProfileModal(); document.body.appendChild(modal); }
  modal.classList.remove('hidden');
  document.getElementById('pm-content').innerHTML = '<p class="search-hint">Yuklanmoqda...</p>';

  try {
    const profile = await getProfile(userId);
    const isMe    = userId === currentUser?.id;
    const fs      = isMe ? null : await getFriendshipStatus(userId);
    renderProfileModal(profile, isMe, fs);
  } catch (e) {
    document.getElementById('pm-content').innerHTML = `<p class="search-hint error">${e.message}</p>`;
  }
}

function createProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profile-box">
      <button class="modal-close" onclick="document.getElementById('profile-modal').classList.add('hidden')">✕</button>
      <div id="pm-content"></div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.add('hidden'); });
  return modal;
}

function renderProfileModal(profile, isMe, friendship) {
  const total = (profile.wins||0) + (profile.losses||0) + (profile.draws||0);
  const winRate = total ? Math.round((profile.wins||0)/total*100) : 0;

  let action = '';
  if (!isMe && currentUser) {
    if (!friendship)
      action = `<button class="btn btn-primary" onclick="sendRequest('${profile.id}',this)">🤝 Do'stlashish</button>`;
    else if (friendship.status==='accepted')
      action = `<button class="btn btn-secondary" disabled>✓ Do'st</button>`;
    else if (friendship.status==='pending' && friendship.sender_id===currentUser.id)
      action = `<button class="btn btn-secondary" disabled>⏳ Kutilmoqda</button>`;
    else if (friendship.status==='pending')
      action = `
        <button class="btn btn-primary"   onclick="acceptRequest('${friendship.id}',this)">✓ Qabul</button>
        <button class="btn btn-secondary" onclick="rejectRequest('${friendship.id}',this)">✗ Rad</button>`;
  }

  document.getElementById('pm-content').innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-lg-wrap" ${isMe ? 'onclick="triggerAvatarUpload()" style="cursor:pointer" title="Rasmni o\'zgartirish"' : ''}>
      <div class="profile-avatar-lg" id="profile-avatar-display">
        ${profile.avatar_url
          ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
          : profile.nickname[0].toUpperCase()}
      </div>
      ${isMe ? `
        <div class="avatar-overlay">📷</div>
        <input type="file" id="avatarFileInput" accept="image/jpeg,image/png,image/webp"
          style="display:none" onchange="handleAvatarUpload(event)">
      ` : ''}
    </div>
      <h2 class="profile-nick">${escapeHtml(profile.nickname)}</h2>
      ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
      <p class="profile-since">Ro'yhatdan o'tgan: ${formatDate(profile.created_at)}</p>
    </div>
    <div class="profile-stats">
      <div class="pstat"><span class="pstat-num win">${profile.wins||0}</span><span class="pstat-lbl">G'alaba</span></div>
      <div class="pstat"><span class="pstat-num loss">${profile.losses||0}</span><span class="pstat-lbl">Yutqizish</span></div>
      <div class="pstat"><span class="pstat-num draw">${profile.draws||0}</span><span class="pstat-lbl">Durrang</span></div>
      <div class="pstat"><span class="pstat-num">${winRate}%</span><span class="pstat-lbl">G'alaba %</span></div>
    </div>
    <div class="profile-actions">${action}</div>
    ${isMe ? `<button class="btn btn-ghost" onclick="openEditProfile()" style="margin-top:12px;width:100%">✎ Profilni tahrirlash</button>` : ''}
  `;
}

async function openEditProfile() {
  document.getElementById('profile-modal')?.classList.add('hidden');
  const bio  = prompt('Bio (qisqa tavsif):', currentProfile?.bio || '');
  if (bio === null) return;
  try {
    await updateProfile(currentUser.id, { bio });
    currentProfile = await getProfile(currentUser.id);
    showToast('Profil yangilandi! ✓');
  } catch (e) { showToast(e.message, 'error'); }
}

// ── YORDAMCHI ────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'Hozirgina';
  if (diff < 3600) return `${Math.floor(diff/60)} daqiqa oldin`;
  if (diff < 86400)return `${Math.floor(diff/3600)} soat oldin`;
  return `${Math.floor(diff/86400)} kun oldin`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('uz-UZ', { year:'numeric', month:'long', day:'numeric' });
}