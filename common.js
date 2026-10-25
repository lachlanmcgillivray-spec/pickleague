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

/** RENAME-V1: the name a player's PIN was created with. Renaming a team keeps this the same,
 * so the kid's PIN keeps working under their new team name. */
function pinSaltFor(player) {
  return player.pinSalt || player.name;
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
    pinSalt: name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
}

/** Checks an entered PIN against a player's stored hash. */
async function verifyPlayerPin(player, pin) {
  if (!isValidPin(pin)) return false;
  const attemptHash = await hashPin(pin, pinSaltFor(player));
  return attemptHash === player.pinHash;
}

/** Sets a PIN for a player who doesn't have one yet (new account or admin reset). */
async function setPlayerPin(player, pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 6 digits.');
  const pinHash = await hashPin(pin, player.name);
  await db.collection('players').doc(player.id).update({ pinHash, pinSalt: player.name });
  player.pinSalt = player.name;
  return pinHash;
}

/** RENAME-V1 (admin only): gives a team a new name. The kid keeps their PIN, badge, real name,
 * and everything they've won. Their picks and mini comp entries switch to the new name so
 * standings show it everywhere. Past Hall of Fame seasons keep the name they won with. */
async function renamePlayer(player, rawName, seasonYear) {
  const name = rawName.trim();
  if (!name) throw new Error('The new name cannot be empty.');
  if (name === player.name) throw new Error("That's already their team name.");
  const players = await getPlayers();
  if (players.some(p => p.id !== player.id && p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Another player already has that name.');
  }
  const batch = db.batch();
  batch.update(db.collection('players').doc(player.id), {
    name,
    pinSalt: pinSaltFor(player),            // keeps their PIN working
    renamedSeason: seasonYear,
    previousNames: firebase.firestore.FieldValue.arrayUnion(player.name)
  });
  const [picks, entries] = await Promise.all([
    db.collection('picks').where('playerId', '==', player.id).get(),
    db.collection('eventPicks').where('playerId', '==', player.id).get().catch(() => ({ docs: [] }))
  ]);
  picks.docs.forEach(d => batch.update(d.ref, { playerName: name }));
  entries.docs.forEach(d => batch.update(d.ref, { playerName: name }));
  await batch.commit();
  return name;
}

/** Admin-only: removes a player and every pick they've ever submitted, so they
 * also disappear from standings rather than lingering as an orphaned record. */
async function deletePlayer(playerId) {
  const picksSnap = await db.collection('picks').where('playerId', '==', playerId).get();
  const batch = db.batch();
  picksSnap.docs.forEach(doc => batch.delete(doc.ref));
       const eventPicksSnap = await db.collection('eventPicks').where('playerId', '==', playerId).get();
     eventPicksSnap.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection('players').doc(playerId));
  await batch.commit();
}

const UnlockedPlayers = {
  key(id) { return `pickleague_unlocked_${id}`; },
  isUnlocked(id) { return localStorage.getItem(this.key(id)) === '1'; },
  unlock(id) { localStorage.setItem(this.key(id), '1'); },
  lock(id) { localStorage.removeItem(this.key(id)); }
};

/** SEASON-YEAR-V1: which season the site is on. Set by "Start new season" on the Hall of Fame;
 * until then it's worked out from today's date (Jan/Feb still belong to last fall's season). */
async function getSeasonYear() {
  try {
    const doc = await db.collection('meta').doc('season').get();
    if (doc.exists && doc.data().year) return doc.data().year;
  } catch (e) { /* rules not published yet: fall back to the date */ }
  const now = new Date();
  return now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear();
}

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

/** True if a week is locked: manually, because its auto-lock time has passed, or (AUTO-LOCK-V1)
 * because every game in it is finished, so nobody has to remember to lock it. */
function isWeekLocked(week) {
  if (!week) return false;
  if (week.locked) return true;
  if (week.lockAt) {
    const d = week.lockAt.toDate ? week.lockAt.toDate() : new Date(week.lockAt);
    if (d.getTime() <= Date.now()) return true;
  }
  const games = week.games || [];
  return games.length > 0 && games.every(g => !!g.winner);
}

/** AUTO-LOCK-V1: true once a game has kicked off (or already has a result). */
function hasGameStarted(game) {
  if (!game) return false;
  if (game.winner) return true;
  if (!game.kickoffAt) return false;
  const d = game.kickoffAt.toDate ? game.kickoffAt.toDate() : new Date(game.kickoffAt);
  return d.getTime() <= Date.now();
}

/** AUTO-LOCK-V1: whether everyone can see who picked this team yet. Picks are revealed at
 * their game's kickoff, or all at once when the week is locked. */
function isPickRevealed(week, team) {
  if (isWeekLocked(week)) return true;
  const game = (week.games || []).find(g => g.away === team || g.home === team);
  return hasGameStarted(game);
}

async function getPick(weekId, playerId) {
  const doc = await db.collection('picks').doc(pickDocId(weekId, playerId)).get();
  return doc.exists ? doc.data() : null;
}

async function savePick(weekId, playerId, playerName, pickedTeams, pinHash) {
  await db.collection('picks').doc(pickDocId(weekId, playerId)).set({
    weekId, playerId, playerName, pickedTeams, pinHash,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/** A player locks their own picks in — a one-way action from their side.
 * Only an admin override can undo it after that. */
async function lockMyPick(weekId, playerId) {
  await db.collection('picks').doc(pickDocId(weekId, playerId)).update({
    pickLocked: true,
    lockedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/** A player unlocks their own picks again, e.g. to fix a mistake before any of their
 * games have started. Only flips the lock flag — doesn't touch the picks themselves. */
async function unlockMyPick(weekId, playerId) {
  await db.collection('picks').doc(pickDocId(weekId, playerId)).update({
    pickLocked: false
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
      // A tie counts as a win for both teams.
      m[g.away] = { decided, won: g.winner === 'away' || g.winner === 'tie' };
      m[g.home] = { decided, won: g.winner === 'home' || g.winner === 'tie' };
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

// ============================================================
// TURDUCKEN-V1: scoring for the Turducken Tussle mini comp (American Thanksgiving).
// Kids pick each game's winner, a Wishbone game (that winner counts double), the Pie Fight
// (highest-scoring game), the Food Coma (lowest-scoring game), Second Helpings (will any game
// go to overtime?) and the Leftovers Guess (total points across every game, closest = +1).
// Event results look like: { winners: {gameId: side}, totals: {gameId: points}, ot: {gameId: true|false} }
// ============================================================
function turduckenMaxPoints(ev) { return ((ev && ev.games) || []).length + 5; }

function turduckenDerived(ev) {
  const res = (ev && ev.results) || {};
  const games = (ev && ev.games) || [];
  const totals = res.totals || {}, ot = res.ot || {}, winners = res.winners || {};
  const allTotals = games.length > 0 && games.every(g => typeof totals[g.id] === 'number');
  let high = null, low = null, sum = null;
  if (allTotals) {
    const vals = games.map(g => totals[g.id]);
    const mx = Math.max(...vals), mn = Math.min(...vals);
    high = games.filter(g => totals[g.id] === mx).map(g => g.id);   // ties: any of them counts
    low = games.filter(g => totals[g.id] === mn).map(g => g.id);
    sum = vals.reduce((a, b) => a + b, 0);
  }
  const anyOT = games.some(g => ot[g.id] === true);
  const allOT = games.length > 0 && games.every(g => typeof ot[g.id] === 'boolean');
  const otAnswer = anyOT ? 'yes' : allOT ? 'no' : null;
  const allWinners = games.length > 0 && games.every(g => winners[g.id]);
  return { high, low, sum, otAnswer, final: allWinners && allTotals && allOT };
}

/** Points for one entry using whatever results are in so far (the closest-guess bonus is
 * added on the leaderboard, since it depends on everyone's guesses). */
function scoreTurduckenEntry(ev, p) {
  const winners = ((ev && ev.results) || {}).winners || {};
  const d = turduckenDerived(ev);
  let points = 0;
  const marks = [];
  ((ev && ev.games) || []).forEach(g => {
    const mine = (p.winners || {})[g.id], actual = winners[g.id];
    const state = !actual ? 'pending' : actual === 'tie' && mine ? 'tie' : mine === actual ? 'yes' : 'no';
    const wish = p.wishbone === g.id;
    if (state === 'yes' || state === 'tie') points += wish ? 2 : 1;
    marks.push({ kind: 'win', gameId: g.id, side: mine, state, wish });
  });
  const pickMark = (kind, set) => {
    const state = !set ? 'pending' : set.includes(p[kind]) ? 'yes' : 'no';
    if (state === 'yes') points += 1;
    marks.push({ kind, gameId: p[kind], state });
  };
  pickMark('pieFight', d.high);
  pickMark('foodComa', d.low);
  const otState = !d.otAnswer ? 'pending' : p.overtime === d.otAnswer ? 'yes' : 'no';
  if (otState === 'yes') points += 1;
  marks.push({ kind: 'overtime', value: p.overtime, state: otState });
  const off = d.sum !== null && typeof p.totalGuess === 'number' ? Math.abs(p.totalGuess - d.sum) : null;
  return { points, off, marks };
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
