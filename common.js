// ============================================================
// Shared helpers: Firebase init, data access, standings math.
// Loaded after config.js and the Firebase SDK <script> tags.
// ============================================================

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

/**
 * Resolves once we have *some* signed-in user (anonymous is fine
 * for regular players; admin.html signs in with email/password on
 * top of this). Firestore rules require request.auth != null.
 */
function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged((user) => {
      if (user) {
        resolve(user);
      } else {
        auth.signInAnonymously().catch(reject);
      }
    });
  });
}

/** Local convenience only (remembers which name this browser used last). */
const LocalPlayer = {
  get() { return localStorage.getItem('pickleague_player_id') || ''; },
  set(id) { localStorage.setItem('pickleague_player_id', id); }
};

async function getPlayers() {
  const snap = await db.collection('players').orderBy('name').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** SHA-256 hex digest. PIN is salted with the player's name so identical
 * PINs across different kids don't produce identical stored hashes. */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hashPin(pin, name) {
  return sha256Hex(`${pin}::${name.trim().toLowerCase()}`);
}

function isValidPin(pin) {
  return /^\d{6}$/.test(pin);
}

/** Creates a brand-new player with a PIN. Throws if the name is already taken. */
async function createPlayer(rawName, pin) {
  const name = rawName.trim();
  if (!name) throw new Error('Name cannot be empty.');
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 6 digits.');
  const players = await getPlayers();
  if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('That name is already taken — pick your existing name from the list instead.');
  }
  const pinHash = await hashPin(pin, name);
  const doc = await db.collection('players').add({
    name,
    pinHash,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
}

/** Checks an entered PIN against a player's stored hash. */
async function verifyPlayerPin(player, pin) {
  if (!isValidPin(pin)) return false;
  const attemptHash = await hashPin(pin, player.name);
  return attemptHash === player.pinHash;
}

/** Sets a PIN for a player who doesn't have one yet (new account or admin reset). */
async function setPlayerPin(player, pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 6 digits.');
  const pinHash = await hashPin(pin, player.name);
  await db.collection('players').doc(player.id).update({ pinHash });
  return pinHash;
}

const UnlockedPlayers = {
  key(id) { return `pickleague_unlocked_${id}`; },
  isUnlocked(id) { return localStorage.getItem(this.key(id)) === '1'; },
  unlock(id) { localStorage.setItem(this.key(id), '1'); },
  lock(id) { localStorage.removeItem(this.key(id)); }
};

async function getWeeks() {
  const snap = await db.collection('weeks').orderBy('weekNumber').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getWeek(weekId) {
  const doc = await db.collection('weeks').doc(weekId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function saveWeek(weekId, data) {
  if (weekId) {
    await db.collection('weeks').doc(weekId).set(data, { merge: true });
    return weekId;
  }
  const doc = await db.collection('weeks').add(data);
  return doc.id;
}

async function deleteWeek(weekId) {
  await db.collection('weeks').doc(weekId).delete();
}

function pickDocId(weekId, playerId) {
  return `${weekId}_${playerId}`;
}

async function getPick(weekId, playerId) {
  const doc = await db.collection('picks').doc(pickDocId(weekId, playerId)).get();
  return doc.exists ? doc.data() : null;
}

async function savePick(weekId, playerId, playerName, picks, pinHash) {
  await db.collection('picks').doc(pickDocId(weekId, playerId)).set({
    weekId, playerId, playerName, picks, pinHash,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function getAllPicksForWeek(weekId) {
  const snap = await db.collection('picks').where('weekId', '==', weekId).get();
  return snap.docs.map(d => d.data());
}

async function getAllPicks() {
  const snap = await db.collection('picks').get();
  return snap.docs.map(d => d.data());
}

/**
 * Builds season standings from every week + every pick.
 * Only games with a `winner` set count toward the record.
 * Returns array sorted best-first: { playerId, playerName, wins, losses, played }
 */
function computeStandings(weeks, allPicks) {
  const winnerByGame = {}; // gameId -> 'away' | 'home'
  weeks.forEach(w => (w.games || []).forEach(g => {
    if (g.winner) winnerByGame[g.id] = g.winner;
  }));

  const totals = {}; // playerId -> { playerName, wins, losses }
  allPicks.forEach(p => {
    if (!totals[p.playerId]) {
      totals[p.playerId] = { playerId: p.playerId, playerName: p.playerName, wins: 0, losses: 0 };
    }
    Object.entries(p.picks || {}).forEach(([gameId, pickedSide]) => {
      const winner = winnerByGame[gameId];
      if (!winner) return; // game not decided yet
      if (pickedSide === winner) totals[p.playerId].wins += 1;
      else totals[p.playerId].losses += 1;
    });
  });

  return Object.values(totals)
    .map(t => ({ ...t, played: t.wins + t.losses }))
    .sort((a, b) => (b.wins - a.wins) || (a.losses - b.losses) || a.playerName.localeCompare(b.playerName));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
