// ============================================================
//  AMIR TEMUR SHAXMATI — supabase.js
//  ⚠️  SUPABASE_URL va SUPABASE_ANON ni o'zgartiring!
// ============================================================
 
const SUPABASE_URL  = 'https://funihfksmqmmpgaktpbj.supabase.co';   // ← o'zgartiring
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1bmloZmtzbXFtbXBnYWt0cGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNjY0NzcsImV4cCI6MjA5NjY0MjQ3N30.Hibama9alpQl2BeMf2t7O2ZpJXqYTfEufp_xN3sEbl4'
let sb = null;
 
function initSupabase() {
  try {
    if (typeof supabase === 'undefined') {
      console.error('Supabase CDN yuklanmadi! index.html da script tagini tekshiring.');
      return false;
    }
    if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON.includes('YOUR_ANON')) {
      console.warn('supabase.js: URL va ANON kalitni kiriting!');
      return false;
    }
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    console.log('Supabase ulandi ✓');
    return true;
  } catch (e) {
    console.error('Supabase init xato:', e);
    return false;
  }
}
 
// Darhol init qilamiz
initSupabase();
 
// sb ni tekshiruvchi wrapper
function getSb() {
  if (!sb) {
    throw new Error('Supabase ulanmagan. supabase.js da URL va ANON kalitni kiriting!');
  }
  return sb;
}
 
// ── AUTH FUNKSIYALARI ─────────────────────────────────────────
 
async function signUp(email, password, nickname) {
  const client = getSb();
 
  // Nickname band emasmi?
  const { data: existing } = await client
    .from('profiles')
    .select('nickname')
    .eq('nickname', nickname)
    .maybeSingle();
 
  if (existing) throw new Error('Bu nickname band. Boshqa tanlang!');
 
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  });
  if (error) throw error;
  return data;
}
 
async function signIn(email, password) {
  const { data, error } = await getSb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
 
async function signOut() {
  const { error } = await getSb().auth.signOut();
  if (error) throw error;
}
 
async function getCurrentUser() {
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
 
async function getProfile(userId) {
  const { data, error } = await getSb()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
 
async function updateProfile(userId, updates) {
  const { data, error } = await getSb()
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
// ── QIDIRUV ───────────────────────────────────────────────────
 
async function searchUsers(query) {
  if (!query || query.length < 2) return [];
  const { data, error } = await getSb()
    .from('profiles')
    .select('id, nickname, avatar_url, wins, losses')
    .ilike('nickname', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return data || [];
}
 
// ── DO'STLIK TIZIMI ───────────────────────────────────────────
 
async function sendFriendRequest(receiverId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Avval login qiling!');
  if (user.id === receiverId) throw new Error("O'zingizga so'rov yubora olmaysiz!");
 
  const { data: existing } = await getSb()
    .from('friendships')
    .select('id, status')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
    .maybeSingle();
 
  if (existing) {
    if (existing.status === 'accepted') throw new Error("Allaqachon do'stsiz!");
    if (existing.status === 'pending')  throw new Error("So'rov allaqachon yuborilgan!");
  }
 
  const { data, error } = await getSb()
    .from('friendships')
    .insert({ sender_id: user.id, receiver_id: receiverId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
async function respondFriendRequest(friendshipId, accept) {
  const { data, error } = await getSb()
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected', updated_at: new Date().toISOString() })
    .eq('id', friendshipId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
async function removeFriend(friendshipId) {
  const { error } = await getSb()
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  if (error) throw error;
}
 
async function getFriends() {
  const { data, error } = await getSb()
    .from('friends_list')
    .select('*');
  if (error) throw error;
  return data || [];
}
 
async function getPendingRequests() {
  const { data, error } = await getSb()
    .from('friend_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
 
async function getFriendshipStatus(otherUserId) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await getSb()
    .from('friendships')
    .select('id, status, sender_id')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .maybeSingle();
  return data;
}
 
// ── REAL-TIME ─────────────────────────────────────────────────
 
function subscribeToFriendRequests(userId, callback) {
  if (!sb) return null;
  return sb
    .channel(`friends-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'friendships',
      filter: `receiver_id=eq.${userId}`
    }, callback)
    .subscribe();
}
 
// ── O'YIN STATISTIKASI ────────────────────────────────────────
 
async function saveGameResult(whiteId, blackId, result) {
  if (!sb) return;
  const winnerId = result === 'white' ? whiteId
                 : result === 'black' ? blackId : null;
  await getSb().from('games').insert({
    white_id: whiteId, black_id: blackId,
    winner_id: winnerId, result
  });
}
 
// ── AUTH HOLAT O'ZGARISHI ─────────────────────────────────────
 
function setupAuthListener() {
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user)
      document.dispatchEvent(new CustomEvent('userSignedIn', { detail: session.user }));
    if (event === 'SIGNED_OUT')
      document.dispatchEvent(new CustomEvent('userSignedOut'));
  });
}
 
// Auth listenerni darhol qo'shamiz
if (sb) {
  setupAuthListener();
} else {
  // CDN hali yuklanmagan bo'lishi mumkin — kichik kechikish
  window.addEventListener('load', () => {
    if (!sb) initSupabase();
    if (sb)  setupAuthListener();
  });
}

async function uploadAvatarToStorage(userId, file) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;
  const { error } = await sb.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl + '?t=' + Date.now();
}

async function updateProfileAvatar(userId, avatarUrl) {
  const { error } = await sb.from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (error) throw error;
}