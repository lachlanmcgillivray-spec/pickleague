// ============================================================
// AUTO-SCORES-V1 · AUTO-LOCK-V1 · TURDUCKEN-V1
// Runs on a schedule from GitHub Actions (.github/workflows/update-scores.yml).
// Reads final NFL scores from ESPN's public scoreboard and fills in winners on
// the site. It only fills in winners that are still blank, so anything the
// admin sets by hand is never overwritten.
//
// Also fills in mini comp (Harvest Bowl) results: each game's winner, plus the
// Golden Drumstick game's final total and who scored first. The coin toss
// stays manual because ESPN doesn't reliably report it.
// For the Turducken Tussle it fills in each game's winner, total points and
// whether it went to overtime.
//
// Once every game in a week has a winner, it also locks that week, so nobody has
// to remember to. (Each game already locks for picks at its own kickoff.)
//
// Set DRY_RUN=1 to print what would change without saving anything.
// ============================================================
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.env.DRY_RUN === '1';
const DAYS_BACK = 10;           // how far back to look for finished games
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT secret. See the setup steps.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

/** "Dallas Cowboys" and "Cowboys" both become "cowboys" (same rule the site uses for logos). */
function teamKey(name) {
  const words = String(name || '').trim().split(/\s+/);
  return words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ymd(d) {
  // Eastern-time calendar date, which is how ESPN groups games.
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return p.replace(/-/g, '');
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'pickleague-score-updater' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

/** Every finished game from the last DAYS_BACK days:
 * { id, awayKey, homeKey, winnerSide ('away'|'home'|'tie'), awayScore, homeScore, kickoff } */
async function loadFinals() {
  const finals = [];
  const seen = new Set();
  for (let i = 0; i <= DAYS_BACK; i++) {
    const day = ymd(new Date(Date.now() - i * 86400000));
    let data;
    try { data = await getJson(`${ESPN}/scoreboard?dates=${day}`); }
    catch (e) { console.warn('Skipping', day, e.message); continue; }
    for (const ev of data.events || []) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const comp = (ev.competitions || [])[0];
      if (!comp || !comp.status || !comp.status.type || !comp.status.type.completed) continue;
      const away = comp.competitors.find(c => c.homeAway === 'away');
      const home = comp.competitors.find(c => c.homeAway === 'home');
      if (!away || !home) continue;
      const as = Number(away.score), hs = Number(home.score);
      const winnerSide = away.winner ? 'away' : home.winner ? 'home' : as === hs ? 'tie' : as > hs ? 'away' : 'home';
      finals.push({
        id: ev.id,
        awayKey: teamKey(away.team.name || away.team.shortDisplayName),
        homeKey: teamKey(home.team.name || home.team.shortDisplayName),
        awayTeamId: away.team.id, homeTeamId: home.team.id,
        winnerSide, awayScore: as, homeScore: hs,
        overtime: (comp.status.period || 0) > 4 || /OT/i.test(comp.status.type.detail || comp.status.type.shortDetail || ''),
        kickoff: new Date(ev.date).getTime()
      });
    }
  }
  return finals;
}

/** Finds the ESPN final for one of our games. Matches on both teams (either way round, in case
 * home/away were typed backwards), choosing the closest kickoff if there's more than one. */
function findFinal(finals, game) {
  const a = teamKey(game.away), h = teamKey(game.home);
  const kick = game.kickoffAt && game.kickoffAt.toDate ? game.kickoffAt.toDate().getTime() : null;
  const matches = finals
    .filter(f => (f.awayKey === a && f.homeKey === h) || (f.awayKey === h && f.homeKey === a))
    .sort((x, y) => kick ? Math.abs(x.kickoff - kick) - Math.abs(y.kickoff - kick) : y.kickoff - x.kickoff);
  const f = matches[0];
  if (!f) return null;
  if (kick && Math.abs(f.kickoff - kick) > 3 * 86400000) return null;   // a different meeting of these two teams
  const flipped = f.awayKey !== a;
  const side = f.winnerSide === 'tie' ? 'tie' : flipped ? (f.winnerSide === 'away' ? 'home' : 'away') : f.winnerSide;
  return { ...f, side, flipped };
}

async function firstScorerSide(final) {
  try {
    const s = await getJson(`${ESPN}/summary?event=${final.id}`);
    const plays = (s.scoringPlays || []).slice().sort((x, y) =>
      (x.period?.number ?? 0) - (y.period?.number ?? 0) || 0);
    const first = plays[0];
    if (!first || !first.team) return null;
    const espnSide = first.team.id === final.awayTeamId ? 'away' : first.team.id === final.homeTeamId ? 'home' : null;
    if (!espnSide) return null;
    return final.flipped ? (espnSide === 'away' ? 'home' : 'away') : espnSide;
  } catch (e) { console.warn('No scoring plays for', final.id, e.message); return null; }
}

async function updateWeeks(finals) {
  const snap = await db.collection('weeks').get();
  let filled = 0, locked = 0;
  for (const doc of snap.docs) {
    const week = doc.data();
    const games = (week.games || []).map(g => ({ ...g }));
    let changed = false;
    for (const g of games) {
      if (g.winner) continue;                     // already set (maybe by hand): leave it alone
      const f = findFinal(finals, g);
      if (!f) continue;
      g.winner = f.side;
      changed = true; filled++;
      console.log(`${week.label || 'Week ' + week.weekNumber}: ${g.away} @ ${g.home} -> ${f.side === 'tie' ? 'TIE' : f.side === 'away' ? g.away : g.home} (${f.awayScore}-${f.homeScore})`);
    }
    const allDone = games.length > 0 && games.every(g => !!g.winner);
    const lockNow = allDone && !week.locked;
    if (lockNow) { locked++; console.log(`${week.label || 'Week ' + week.weekNumber}: every game is final, locking the week.`); }
    if ((changed || lockNow) && !DRY_RUN) {
      const update = { games, autoScoredAt: new Date() };
      if (lockNow) update.locked = true;
      await doc.ref.update(update);
    }
  }
  return { filled, locked };
}

async function updateMiniComps(finals) {
  let snap;
  try { snap = await db.collection('events').get(); } catch (e) { return 0; }
  let filled = 0;
  for (const doc of snap.docs) {
    const ev = doc.data();
    const games = ev.games || [];
    if (!games.length) continue;
    if (ev.type === 'turducken' || /^turducken/.test(doc.id)) {
      const res = { ...(ev.results || {}) };
      res.winners = { ...(res.winners || {}) }; res.totals = { ...(res.totals || {}) }; res.ot = { ...(res.ot || {}) };
      let changed = false;
      for (const g of games) {
        const f = findFinal(finals, g);
        if (!f) continue;
        if (!res.winners[g.id]) { res.winners[g.id] = f.side; changed = true; filled++; }
        if (typeof res.totals[g.id] !== 'number') { res.totals[g.id] = f.awayScore + f.homeScore; changed = true; filled++; }
        if (typeof res.ot[g.id] !== 'boolean') { res.ot[g.id] = !!f.overtime; changed = true; filled++; }
      }
      if (changed) {
        console.log(`${ev.name || doc.id}: results now`, JSON.stringify(res));
        if (!DRY_RUN) await doc.ref.update({ results: res, autoScoredAt: new Date() });
      }
      continue;
    }
    const res = { winners: {}, ...(ev.results || {}) };
    res.winners = { ...(res.winners || {}) };
    let changed = false;
    for (const g of games) {
      const f = findFinal(finals, g);
      if (!f) continue;
      if (!res.winners[g.id]) { res.winners[g.id] = f.side; changed = true; filled++; }
      if (g.id === ev.drumstickId) {
        if (typeof res.totalPoints !== 'number') { res.totalPoints = f.awayScore + f.homeScore; changed = true; filled++; }
        if (!res.firstScore) {
          const side = await firstScorerSide(f);
          if (side) { res.firstScore = side; changed = true; filled++; }
        }
      }
    }
    if (changed) {
      console.log(`${ev.name || doc.id}: results now`, JSON.stringify(res));
      if (!DRY_RUN) await doc.ref.update({ results: res, autoScoredAt: new Date() });
    }
  }
  return filled;
}

const finals = await loadFinals();
console.log(`Found ${finals.length} finished NFL games in the last ${DAYS_BACK} days.`);
const w = await updateWeeks(finals);
const m = await updateMiniComps(finals);
console.log(`${DRY_RUN ? '[dry run] would fill' : 'Filled'} ${w.filled} weekly winner(s) and ${m} mini comp result(s)${w.locked ? `, and ${DRY_RUN ? 'would lock' : 'locked'} ${w.locked} finished week(s)` : ''}.`);
process.exit(0);
