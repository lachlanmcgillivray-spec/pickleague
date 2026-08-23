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

/** Admin-only: removes a player and every pick they've ever submitted, so they
 * also disappear from standings rather than lingering as an orphaned record. */
async function deletePlayer(playerId) {
  const picksSnap = await db.collection('picks').where('playerId', '==', playerId).get();
  const batch = db.batch();
  picksSnap.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('players').doc(playerId));
  await batch.commit();
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

async function savePick(weekId, playerId, playerName, pickedTeams, pinHash) {
  await db.collection('picks').doc(pickDocId(weekId, playerId)).set({
    weekId, playerId, playerName, pickedTeams, pinHash,
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

/** Every team playing in a given week, with who they're up against.
 * Returns [{ team, opponent, gameId, side }], one entry per team (both sides of every game). */
function getWeekTeams(week) {
  const list = [];
  (week.games || []).forEach(g => {
    list.push({ team: g.away, opponent: g.home, gameId: g.id, side: 'away' });
    list.push({ team: g.home, opponent: g.away, gameId: g.id, side: 'home' });
  });
  return list;
}

/** weekId -> { teamName: { decided, won } }, used to score picks. */
function buildTeamResultsByWeek(weeks) {
  const map = {};
  weeks.forEach(w => {
    const m = {};
    (w.games || []).forEach(g => {
      const decided = !!g.winner;
      m[g.away] = { decided, won: g.winner === 'away' };
      m[g.home] = { decided, won: g.winner === 'home' };
    });
    map[w.id] = m;
  });
  return map;
}

/**
 * Season standings: 1 point per correctly-picked team that won,
 * plus a bonus point for a perfect 3-for-3 week.
 * Only games with a winner set are counted (pending games score 0 either way).
 * Returns array sorted best-first: { playerId, playerName, points }
 */
function computeStandings(weeks, allPicks) {
  const resultsByWeek = buildTeamResultsByWeek(weeks);
  const totals = {};

  allPicks.forEach(p => {
    if (!totals[p.playerId]) {
      totals[p.playerId] = { playerId: p.playerId, playerName: p.playerName, points: 0 };
    }
    const teams = p.pickedTeams || [];
    const results = resultsByWeek[p.weekId] || {};
    let correct = 0;
    teams.forEach(team => {
      const r = results[team];
      if (r && r.decided && r.won) correct += 1;
    });
    const bonus = (teams.length === 3 && correct === 3) ? 1 : 0;
    totals[p.playerId].points += correct + bonus;
  });

  return Object.values(totals)
    .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName));
}

/** How many of a pick's teams were correct winners (for per-week display), plus bonus flag. */
function scorePick(pick, week) {
  const resultsByWeek = buildTeamResultsByWeek([week]);
  const results = resultsByWeek[week.id] || {};
  const teams = pick.pickedTeams || [];
  let correct = 0;
  teams.forEach(team => {
    const r = results[team];
    if (r && r.decided && r.won) correct += 1;
  });
  const anyPending = teams.some(team => !results[team] || !results[team].decided);
  const bonus = (teams.length === 3 && correct === 3);
  return { correct, bonus, points: correct + (bonus ? 1 : 0), anyPending };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

/** NFL nickname -> logo code, used to show a small team logo beside the name.
 * Matches on the LAST word of whatever team name the admin typed in
 * (e.g. "Dallas Cowboys" or just "Cowboys" both match "cowboys"). */
const TEAM_LOGOS = {
  cowboys: 'dal', eagles: 'phi', giants: 'nyg', commanders: 'wsh',
  bears: 'chi', lions: 'det', packers: 'gb', vikings: 'min',
  falcons: 'atl', panthers: 'car', saints: 'no', buccaneers: 'tb',
  cardinals: 'ari', rams: 'lar', '49ers': 'sf', seahawks: 'sea',
  bills: 'buf', dolphins: 'mia', patriots: 'ne', jets: 'nyj',
  ravens: 'bal', bengals: 'cin', browns: 'cle', steelers: 'pit',
  texans: 'hou', colts: 'ind', jaguars: 'jax', titans: 'ten',
  broncos: 'den', chiefs: 'kc', raiders: 'lv', chargers: 'lac'
};

function getTeamLogoUrl(teamName) {
  if (!teamName) return null;
  const words = teamName.trim().split(/\s+/);
  const key = words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  const code = TEAM_LOGOS[key];
  return code ? `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${code}.png` : null;
}

function teamLogoImgTag(teamName, size) {
  const url = getTeamLogoUrl(teamName);
  if (!url) return '';
  const px = size || 40;
  return `<img class="team-logo" src="${url}" alt="" width="${px}" height="${px}" onerror="this.remove()">`;
}

/** Renders a player's admin-uploaded badge image, or a plain placeholder circle if none set. */
function playerBadgeImgTag(player, size) {
  const px = size || 40;
  if (player && player.badgeUrl) {
    return `<img class="player-badge" src="${player.badgeUrl}" width="${px}" height="${px}" style="width:${px}px;height:${px}px;">`;
  }
  return `<span class="player-badge placeholder" style="width:${px}px;height:${px}px;"></span>`;
}
