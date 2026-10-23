// ============================================================
// HOF-JS-V2: shared season math for the I Scream Hall of Fame (halloffame.html)
// and the Season Wrap-Up tab on admin.html. Loaded after common.js.
// ============================================================

// The Hall of Fame card styles, added to whichever page loads this file.
document.head.insertAdjacentHTML('beforeend', `<style>
  /* Hall of Fame styles live inline so a cached styles.css can't break them */
  main.wrap { position:relative; z-index:1; }
  .hof-intro { text-align:center; }
  .hof-intro .cone { font-size:46px; line-height:1; display:block; }
  .hof-intro h2 { font-family:var(--font-display); font-weight:400; font-size:30px; color:var(--navy); margin:6px 0 4px; letter-spacing:.5px; }
  .hof-intro p { margin:4px auto; max-width:52ch; }

  .hof-champ { position:relative; overflow:hidden; text-align:center; padding:26px 20px 22px; margin:6px 0 24px;
    border:4px solid var(--gold-dark); border-radius:22px; color:white;
    background:radial-gradient(circle at 50% 0%, #2B3F7A 0%, var(--navy) 55%, var(--navy-dark) 100%);
    box-shadow:0 10px 26px rgba(16,31,69,0.28); }
  .hof-champ::before, .hof-champ::after { content:'🍦'; position:absolute; font-size:84px; opacity:.16; top:-6px; }
  .hof-champ::before { left:-8px; transform:rotate(-18deg); }
  .hof-champ::after { right:-8px; transform:rotate(18deg); }
  .hof-kicker { font-family:var(--font-fun); font-weight:700; letter-spacing:2px; font-size:13px; color:var(--gold); text-transform:uppercase; }
  .hof-champ-title { font-family:var(--font-display); font-weight:400; font-size:36px; letter-spacing:1px; color:var(--pink); margin:2px 0 14px; line-height:1.05; }
  .hof-winners { display:flex; justify-content:center; flex-wrap:wrap; gap:18px; }
  .hof-one { display:flex; flex-direction:column; align-items:center; gap:6px; min-width:150px; }
  .hof-one .trophy { font-size:46px; line-height:1; }
  .hof-name { font-family:var(--font-fun); font-weight:700; font-size:24px; color:white; }
  .hof-kid { font-size:14px; color:#C9D2EE; }
  .hof-stat { font-size:14px; color:var(--gold); font-weight:600; }
  .hof-note { font-size:12px; color:#C9D2EE; margin-top:12px; }

  .hof-minis { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:24px; }
  .hof-mini { border-radius:18px; padding:16px; text-align:center; border:3px solid var(--pumpkin, #E8742B);
    background:linear-gradient(160deg, #FFF4E2 0%, #FFE6C7 100%); }
  .hof-mini .mini-emoji { font-size:34px; line-height:1; }
  .hof-mini .mini-name { font-family:var(--font-display); font-size:22px; color:var(--navy); margin:4px 0 8px; letter-spacing:.5px; }
  .hof-mini .mini-winner { font-family:var(--font-fun); font-weight:700; font-size:18px; color:var(--navy); }
  .hof-mini .mini-sub { font-size:13px; color:var(--ink-soft); margin-top:4px; }
  .hof-mini.pending { border-style:dashed; opacity:.85; }

  .hof-awards { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; }
  .hof-award { background:white; border-radius:18px; padding:16px; box-shadow:var(--shadow); border-top:6px solid var(--pink); display:flex; flex-direction:column; gap:8px; }
  .hof-award:nth-child(3n+2) { border-top-color:var(--gold); }
  .hof-award:nth-child(3n) { border-top-color:var(--navy); }
  .hof-award-head { display:flex; align-items:center; gap:10px; }
  .hof-award-emoji { font-size:30px; line-height:1; }
  .hof-award-title { font-family:var(--font-fun); font-weight:700; font-size:17px; color:var(--navy); }
  .hof-award-desc { font-size:13px; color:var(--ink-soft); }
  .hof-award-win { display:flex; align-items:center; gap:10px; background:#FFF8E6; border-radius:12px; padding:8px 10px; }
  .hof-award-win strong { font-family:var(--font-fun); font-size:16px; color:var(--navy); }
  .hof-award-win .why { font-size:13px; color:var(--pink-dark); font-weight:600; }
  .hof-award-empty { font-size:13px; color:var(--ink-soft); font-style:italic; }
  
  .hof-kings { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; }
  .hof-king { background:white; border-radius:12px; padding:8px 12px; font-size:14px; box-shadow:var(--shadow); }
  .hof-king b { font-family:var(--font-fun); color:var(--navy); }
  .hof-king span { display:block; color:var(--ink-soft); font-size:12px; }

  .hof-now { font-size:.72em; font-weight:500; opacity:.75; white-space:nowrap; }
  .hof-season-label { text-align:center; font-family:var(--font-display) !important; font-weight:400; letter-spacing:1px; color:var(--navy); }
  .hof-recap { display:flex; flex-direction:column; gap:8px; }
  .hof-recap-row { display:flex; align-items:flex-start; gap:12px; background:white; border-radius:12px; padding:10px 12px; box-shadow:var(--shadow); }
  .hof-recap-rank { font-family:var(--font-display); font-size:22px; color:var(--pink); min-width:28px; text-align:center; }
  .hof-recap-main { flex:1; min-width:0; }
  .hof-recap-main strong { font-family:var(--font-fun); color:var(--navy); font-size:16px; }
  .hof-recap-line { font-size:13px; color:var(--ink-soft); margin-top:2px; }
  .hof-recap-pts { font-family:var(--font-display); font-size:24px; color:var(--pink-dark); text-align:right; }
  .hof-recap-pts small { display:block; font-family:var(--font-body); font-size:11px; color:var(--ink-soft); }
  .hof-past { background:white; border-radius:16px; box-shadow:var(--shadow); margin-bottom:12px; overflow:hidden; border-left:6px solid var(--gold); }
  .hof-past summary { cursor:pointer; padding:14px 16px; display:flex; align-items:center; gap:14px; list-style:none; }
  .hof-past summary::-webkit-details-marker { display:none; }
  .hof-past summary::after { content:'▾'; margin-left:auto; color:var(--ink-soft); transition:transform .2s; }
  .hof-past[open] summary::after { transform:rotate(180deg); }
  .hof-past-year { font-family:var(--font-display); font-size:26px; color:var(--navy); }
  .hof-past-champ { font-family:var(--font-fun); font-weight:700; color:var(--pink-dark); }
  .hof-past-body { padding:0 14px 16px; background:#FBF8F1; }
  .hof-admin { border:2px dashed var(--navy); margin-top:24px; }
  .hof-admin h3 { font-family:var(--font-fun); color:var(--navy); margin:18px 0 4px; }
  .hof-admin p { font-size:14px; }
  .hof-admin label { display:block; font-size:13px; font-weight:600; margin:10px 0 4px; color:var(--navy); }
  .hof-admin button { margin-top:8px; }
  .hof-admin button[disabled] { opacity:.5; cursor:not-allowed; }
  @media (max-width:520px) { .hof-champ-title { font-size:28px; } .hof-name { font-size:20px; } }
</style>`);

/** The draft-kit categories (same list as The Scoop). Teams match on their last word. */
const CATEGORIES = [
  { name: 'Big Cats',               emoji: '🐾', teams: ['lions', 'bengals', 'jaguars', 'panthers'] },
  { name: 'Breaking the Law',       emoji: '🚔', teams: ['buccaneers', 'raiders', 'cowboys', 'vikings', 'patriots'] },
  { name: 'The Wild West',          emoji: '🌵', teams: ['bills', 'texans', 'chiefs'] },
  { name: 'Gods & Monsters',        emoji: '✨', teams: ['saints', 'giants', 'titans'] },
  { name: 'Working 9-5',            emoji: '🕘', teams: ['packers', 'steelers', 'commanders'] },
  { name: 'Angry Birds',            emoji: '🐦', teams: ['cardinals', 'falcons', 'ravens', 'eagles', 'seahawks'] },
  { name: 'The Elements',           emoji: '🔥', teams: ['dolphins', 'bears', 'chargers', '49ers'] },
  { name: 'Old McNFL Had a Farm',   emoji: '🚜', teams: ['broncos', 'colts', 'rams'] },
  { name: 'The Factory of Sadness', emoji: '🏭', teams: ['jets', 'browns'] }
];
const FINAL_WEEK = 18; // the season counts as finished once this week's games all have results

function teamKey(name) {
  const w = String(name || '').trim().split(/\s+/);
  return w[w.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
}
function toMs(ts) { return ts ? (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime()) : null; }
function plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; }

let players = [], playersById = {}, weeks = [], picks = [], events = [], eventPicks = [];
let standingRank = {};   // playerId -> rank (1 = top), used for every tiebreak
let seasonYear = null, pastSeasons = [];

/** Loads everything the Hall of Fame needs and returns the season standings. */
async function loadHofData() {
  [players, weeks, picks, seasonYear] = await Promise.all([getPlayers(), getWeeks(), getAllPicks(), getSeasonYear()]);
  playersById = {};
  players.forEach(p => { playersById[p.id] = p; });
  picks = picks.filter(p => playersById[p.playerId]);              // skip removed players
  weeks.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  try {
    const [evSnap, epSnap] = await Promise.all([db.collection('events').get(), db.collection('eventPicks').get()]);
    events = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    eventPicks = epSnap.docs.map(d => d.data()).filter(p => playersById[p.playerId]);
  } catch (e) { console.error(e); events = []; eventPicks = []; }
  await loadPastSeasons();
  const standings = computeStandings(weeks, picks).filter(s => playersById[s.playerId]);
  standingRank = {};
  standings.forEach((s, i) => { standingRank[s.playerId] = i + 1; });
  return standings;
}

async function loadPastSeasons() {
  try {
    const snap = await db.collection('seasons').get();
    pastSeasons = snap.docs.map(d => d.data()).sort((x, y) => y.year - x.year);
  } catch (e) { console.error(e); pastSeasons = []; }
}

function seasonIsFinal() {
  const last = weeks.find(w => w.weekNumber === FINAL_WEEK);
  return !!(last && (last.games || []).length && last.games.every(g => g.winner));
}

/** Badge for an archived name: uses the player's current badge if they're still in the league. */
function badgeFor(playerId, size) {
  return playerBadgeImgTag(playersById[playerId] || { name: '' }, size);
}

// ---------- mini comps (Harvest Bowl format) ----------
/** True once every mini-comp result has been entered. */
function miniCompFinal(ev) {
  const res = (ev && ev.results) || {};
  const games = (ev && ev.games) || [];
  return !!(games.length && games.every(g => (res.winners || {})[g.id]) && res.coinToss && res.firstScore && typeof res.totalPoints === 'number');
}

/** Scores every entry in a mini comp, using whatever results are in so far.
 * Returns rows sorted best-first: { p, points, off, rank } (off = how far the Gobbler Guess was from the real total). */
function scoreMiniEntries(ev, entries) {
  const res = ev.results || {};
  const winners = res.winners || {};
  const games = ev.games || [];
  const rows = entries.map(p => {
    let points = 0;
    games.forEach(g => {
      const actual = winners[g.id], mine = (p.winners || {})[g.id];
      if (actual && mine && (actual === 'tie' || mine === actual)) points += g.id === ev.drumstickId ? 2 : 1;
    });
    if (res.coinToss && p.coinToss === res.coinToss) points += 1;
    if (res.firstScore && p.firstScore === res.firstScore) points += 1;
    const off = typeof res.totalPoints === 'number' && typeof p.totalGuess === 'number' ? Math.abs(p.totalGuess - res.totalPoints) : null;
    return { p, points, off };
  });
  const offs = rows.filter(r => r.off !== null).map(r => r.off);
  if (offs.length) { const best = Math.min(...offs); rows.forEach(r => { if (r.off === best) { r.points += 1; r.closest = true; } }); }
  rows.sort((a, b) => b.points - a.points || (a.off ?? 9999) - (b.off ?? 9999) || a.p.playerName.localeCompare(b.p.playerName));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = (!prev || prev.points !== r.points || (prev.off ?? 9999) !== (r.off ?? 9999)) ? i + 1 : prev.rank;
  });
  return rows;
}

/** Final mini-comp result for the Hall of Fame, or null while it's still being played. */
function scoreMiniComp(ev) {
  if (!miniCompFinal(ev)) return null;
  const rows = scoreMiniEntries(ev, eventPicks.filter(p => p.eventId === ev.id));
  return { winners: rows.filter(r => r.rank === 1), total: rows.length };
}

function miniEmoji(name) {
  return /harvest|turkey/i.test(name) ? '🦃' : /stocking|christmas/i.test(name) ? '🎄' : '🏅';
}
function buildMinis() {
  return events.map(ev => {
    const name = ev.name || 'Mini comp';
    const result = scoreMiniComp(ev);
    if (!result) return { name, emoji: miniEmoji(name), final: false };
    return { name, emoji: miniEmoji(name), final: true, total: result.total,
      points: result.winners[0] ? result.winners[0].points : 0,
      winners: result.winners.map(r => ({ playerId: r.p.playerId, name: r.p.playerName })) };
  });
}

// ---------- season stats for the fun awards ----------
/** Every decided pick in time order: { playerId, team, weekIdx, won } plus per-week info. */
function buildSeasonData() {
  const weekById = {}; weeks.forEach((w, i) => { weekById[w.id] = { w, i }; });
  const perPlayer = {};
  players.forEach(p => { perPlayer[p.id] = { picks: [], teams: {}, weeks: [] }; });

  picks.forEach(pk => {
    const info = weekById[pk.weekId];
    if (!info) return;
    const games = info.w.games || [];
    const entry = perPlayer[pk.playerId];
    const weekPicks = [];
    (pk.pickedTeams || []).forEach(team => {
      const gi = games.findIndex(g => g.away === team || g.home === team);
      const g = games[gi];
      const decided = !!(g && g.winner);
      const won = decided && (g.winner === 'tie' || (g.winner === 'away' ? g.away : g.home) === team);
      const kick = g ? (toMs(g.kickoffAt) || 0) : 0;
      const row = { team, weekIdx: info.i, gameIdx: gi, kick, decided, won };
      entry.teams[team] = (entry.teams[team] || 0) + 1;
      entry.picks.push(row);
      weekPicks.push(row);
    });
    entry.weeks.push({ weekId: pk.weekId, weekIdx: info.i, rows: weekPicks, lockedAt: pk.pickLocked !== false ? toMs(pk.lockedAt) : null });
  });
  Object.values(perPlayer).forEach(e => e.picks.sort((a, b) => a.weekIdx - b.weekIdx || a.kick - b.kick || a.gameIdx - b.gameIdx));
  return perPlayer;
}

function categoryCount(entry, cat) {
  return Object.entries(entry.teams).reduce((n, [team, c]) => n + (cat.teams.includes(teamKey(team)) ? c : 0), 0);
}

/** Each award: compute(entry, playerId, ctx) -> { value, why } or null if not eligible. Higher value wins
 * (lowerIsBetter flips it). */
function buildAwards(data) {
  // How many players picked each team, per week (for Lone Wolf).
  const pickersByWeekTeam = {};
  picks.forEach(pk => (pk.pickedTeams || []).forEach(t => {
    const k = pk.weekId + '|' + t; pickersByWeekTeam[k] = (pickersByWeekTeam[k] || 0) + 1;
  }));
  const entrantsByWeek = {};
  picks.forEach(pk => { entrantsByWeek[pk.weekId] = (entrantsByWeek[pk.weekId] || 0) + 1; });

  // Early Bird: order of lock-ins each week.
  const firstLocks = {}, lockPctSum = {}, lockWeeks = {};
  weeks.forEach(w => {
    const locked = picks.filter(p => p.weekId === w.id && p.pickLocked !== false && toMs(p.lockedAt))
      .sort((a, b) => toMs(a.lockedAt) - toMs(b.lockedAt));
    if (locked.length < 2) return;
    locked.forEach((p, i) => {
      lockPctSum[p.playerId] = (lockPctSum[p.playerId] || 0) + i / (locked.length - 1);
      lockWeeks[p.playerId] = (lockWeeks[p.playerId] || 0) + 1;
      if (i === 0) firstLocks[p.playerId] = (firstLocks[p.playerId] || 0) + 1;
    });
  });

  // Comeback Kid: rank after each week that has any results.
  const climb = {};
  const decidedWeeks = weeks.filter(w => (w.games || []).some(g => g.winner));
  if (decidedWeeks.length >= 2) {
    const worst = {};
    decidedWeeks.forEach((w, i) => {
      const upTo = decidedWeeks.slice(0, i + 1).map(x => x.id);
      const table = computeStandings(decidedWeeks.slice(0, i + 1), picks.filter(p => upTo.includes(p.weekId)));
      const pts = {}; table.forEach(t => { pts[t.playerId] = t.points; });
      // competition ranking: everyone tied shares the rank
      const rankOf = id => 1 + table.filter(t => t.points > (pts[id] || 0)).length;
      players.forEach(p => {
        const r = rankOf(p.id);
        if (i > 0 && worst[p.id] !== undefined) climb[p.id] = Math.max(climb[p.id] || 0, worst[p.id] - r);
        worst[p.id] = Math.max(worst[p.id] || 0, r);
      });
    });
  }

  const maxDecided = Math.max(0, ...Object.values(data).map(e => e.picks.filter(r => r.decided).length));

  return [
    { id: 'bigcat', emoji: '🐾', title: 'Big Cat Collector', desc: 'Picked the most Big Cats: Lions, Bengals, Jaguars and Panthers.',
      compute: e => { const n = categoryCount(e, CATEGORIES[0]); return n ? { value: n, why: plural(n, 'Big Cat pick') } : null; } },
    { id: 'streak', emoji: '🔥', title: 'Hot Streak', desc: 'The longest run of correct picks in a row.',
      compute: e => { let best = 0, cur = 0; e.picks.filter(r => r.decided).forEach(r => { cur = r.won ? cur + 1 : 0; best = Math.max(best, cur); });
        return best ? { value: best, why: `${best} correct in a row` } : null; } },
    { id: 'perfect', emoji: '🍨', title: 'Perfect Sundae', desc: 'The most perfect 3-for-3 weeks.',
      compute: e => { const n = e.weeks.filter(w => w.rows.length === 3 && w.rows.every(r => r.decided && r.won)).length;
        return n ? { value: n, why: plural(n, 'perfect week') } : null; } },
    { id: 'lonewolf', emoji: '🐺', title: 'Lone Wolf', desc: 'The most correct picks of teams almost nobody else chose.',
      compute: (e, id) => { let n = 0;
        picks.filter(p => p.playerId === id).forEach(pk => (pk.pickedTeams || []).forEach(t => {
          const row = e.picks.find(r => r.team === t && weeks[r.weekIdx] && weeks[r.weekIdx].id === pk.weekId);
          const limit = Math.max(2, Math.floor((entrantsByWeek[pk.weekId] || 0) * 0.2));
          if (row && row.won && (pickersByWeekTeam[pk.weekId + '|' + t] || 0) <= limit) n++;
        }));
        return n ? { value: n, why: plural(n, 'bold pick') + ' that won' } : null; } },
    { id: 'earlybird', emoji: '🐦', title: 'Early Bird', desc: 'Usually the first to lock in their picks each week.',
      compute: (e, id) => { if (!lockWeeks[id] || lockWeeks[id] < 2) return null;
        const avg = lockPctSum[id] / lockWeeks[id]; const firsts = firstLocks[id] || 0;
        return { value: (1 - avg) * 1000 + firsts, why: firsts ? `First to lock in ${plural(firsts, 'time')}` : 'Always early to lock in' }; } },
    { id: 'loyal', emoji: '💙', title: 'Loyal Fan', desc: 'Picked the same team the most times.',
      compute: e => { const top = Object.entries(e.teams).sort((a, b) => b[1] - a[1])[0];
        return top && top[1] > 1 ? { value: top[1], why: `Picked the ${top[0].split(' ').pop()} ${top[1]} times` } : null; } },
    { id: 'globe', emoji: '🌎', title: 'Globetrotter', desc: 'Picked the most different teams.',
      compute: e => { const n = Object.keys(e.teams).length; return n ? { value: n, why: plural(n, 'different team') } : null; } },
    { id: 'comeback', emoji: '📈', title: 'Comeback Kid', desc: 'The biggest climb up the standings from their lowest spot.',
      compute: (e, id) => climb[id] > 0 ? { value: climb[id], why: `Climbed ${plural(climb[id], 'spot')}` } : null },
    { id: 'sadness', emoji: '🏭', title: 'Factory of Sadness Survivor', desc: 'The brave soul who picked the Jets and Browns the most.',
      compute: e => { const n = categoryCount(e, CATEGORIES[8]); return n ? { value: n, why: plural(n, 'Jets/Browns pick') } : null; } },
    { id: 'sharp', emoji: '🎯', title: 'Sharpshooter', desc: 'The best win percentage (needs at least half as many decided picks as the busiest player).',
      compute: e => { const d = e.picks.filter(r => r.decided); if (!d.length || d.length < maxDecided / 2) return null;
        const w = d.filter(r => r.won).length; const pct = w / d.length;
        return { value: pct, why: `${Math.round(pct * 100)}% (${w} of ${d.length})` }; } }
  ];
}

/** Rank candidates for every award, then hand out awards so no kid wins more than their share.
 * Ties go to whoever is higher in the season standings. */
function assignAwards(awards, data) {
  const eligibleIds = players.map(p => p.id);
  awards.forEach(a => {
    a.ranked = eligibleIds.map(id => ({ id, r: a.compute(data[id], id) }))
      .filter(x => x.r)
      .sort((x, y) => y.r.value - x.r.value || (standingRank[x.id] || 999) - (standingRank[y.id] || 999));
  });
  const contenders = new Set(awards.flatMap(a => a.ranked.map(x => x.id)));
  const cap = Math.max(1, Math.ceil(awards.length / Math.max(1, contenders.size)));
  const won = {};
  awards.forEach(a => {
    if (!a.ranked.length) return;
    const pick = a.ranked.find(x => (won[x.id] || 0) < cap) || a.ranked[0];
    a.winner = pick;
    won[pick.id] = (won[pick.id] || 0) + 1;
  });
  return cap;
}

// ---------- the season summary (used live, for the archive, and to redraw past seasons) ----------
function personInfo(id) {
  const p = playersById[id];
  return { playerId: id, name: p ? p.name : '?', kidName: (p && p.kidName) || '' };
}

function buildSnapshot(standings) {
  const data = buildSeasonData();
  const awards = buildAwards(data);
  const cap = assignAwards(awards, data);
  const scored = standings.filter(s => s.points > 0);
  const top = scored.length ? scored[0].points : 0;

  const recap = standings.map((s, i) => {
    const e = data[s.playerId] || { picks: [], teams: {} };
    const decided = e.picks.filter(r => r.decided);
    const topTeams = Object.entries(e.teams).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([team, n]) => ({ team, n }));
    const cats = CATEGORIES.map(c => ({ c, n: categoryCount(e, c) })).sort((x, y) => y.n - x.n);
    return { ...personInfo(s.playerId), rank: 1 + standings.filter(o => o.points > s.points).length, points: s.points,
      won: decided.filter(r => r.won).length, decided: decided.length, topTeams,
      favCategory: cats[0] && cats[0].n ? `${cats[0].c.emoji} ${cats[0].c.name}` : '' };
  });

  return {
    year: seasonYear,
    final: seasonIsFinal(),
    champions: scored.filter(s => s.points === top).map(s => ({ ...personInfo(s.playerId), points: s.points })),
    minis: buildMinis(),
    cap,
    awards: awards.map(a => ({ emoji: a.emoji, title: a.title, desc: a.desc,
      winner: a.winner ? { ...personInfo(a.winner.id), why: a.winner.r.why } : null })),
    kings: CATEGORIES.map(cat => {
      const ranked = players.map(p => ({ id: p.id, n: categoryCount(data[p.id], cat) })).filter(x => x.n > 0)
        .sort((x, y) => y.n - x.n || (standingRank[x.id] || 999) - (standingRank[y.id] || 999));
      return { emoji: cat.emoji, category: cat.name, winner: ranked[0] ? { ...personInfo(ranked[0].id), n: ranked[0].n } : null };
    }),
    standings: recap
  };
}

/** RENAME-V1: in past seasons, shows "now Mint Machine" when a team has been renamed since. */
function nowKnownAs(playerId, oldName) {
  const p = playersById[playerId];
  return p && p.name !== oldName ? ` <span class="hof-now">(now ${escapeHtml(p.name)})</span>` : '';
}

function champBlock(c, archived) {
  return `<div class="hof-one">
    <span class="trophy" aria-hidden="true">🏆</span>
    ${badgeFor(c.playerId, 64)}
    <div class="hof-name">${escapeHtml(c.name)}${archived ? nowKnownAs(c.playerId, c.name) : ''}</div>
    ${c.kidName ? `<div class="hof-kid">${escapeHtml(c.kidName)}</div>` : ''}
    <div class="hof-stat">${c.points} points</div>
  </div>`;
}

/** Draws a season summary. archived = a past season (always shown as final, plus the full standings recap). */
function renderSnapshot(snap, archived) {
  const final = archived || snap.final;
  const many = snap.champions.length > 1;
  const champ = !snap.champions.length
    ? `<div class="card" style="text-align:center;">No results yet. The champion shows up here once games are decided.</div>`
    : `<div class="hof-champ">
        <div class="hof-kicker">${final ? `${snap.year} season champion` : `${snap.year} season so far`}</div>
        <div class="hof-champ-title">${final ? (many ? 'Sundae Co-Champions' : 'Sundae Champion') : (many ? 'Tied for the lead' : 'Leading the way')}</div>
        <div class="hof-winners">${snap.champions.map(c => champBlock(c, archived)).join('')}</div>
        ${final ? '' : `<div class="hof-note">The crown is official once Week ${FINAL_WEEK} results are in.</div>`}
      </div>`;

  const minis = !snap.minis.length ? '' : `<h2 class="section-title">🏅 Mini Comp Champions</h2><div class="hof-minis">${snap.minis.map(m => !m.final
    ? `<div class="hof-mini pending"><div class="mini-emoji">${m.emoji}</div><div class="mini-name">${escapeHtml(m.name)}</div>
        <div class="mini-sub">Still being played. The champion appears once every result is in.</div></div>`
    : `<div class="hof-mini"><div class="mini-emoji">${m.emoji}</div><div class="mini-name">${escapeHtml(m.name)}</div>
        <div class="mini-winner">🏆 ${m.winners.map(w => escapeHtml(w.name) + (archived ? nowKnownAs(w.playerId, w.name) : '')).join(' &amp; ') || 'No entries'}</div>
        ${m.winners.length ? `<div class="mini-sub">${m.points} of 7 points · ${m.winners.length > 1 ? 'Co-champions' : 'Champion'} of ${plural(m.total, 'player')}</div>` : ''}</div>`).join('')}</div>`;

  const awards = `<h2 class="section-title">🍦 The Fun Awards</h2>
    ${archived ? '' : `<p class="muted" style="margin-top:-6px;">Each kid can win up to ${plural(snap.cap, 'award')}, so the prizes get shared around. Ties go to whoever is higher in the standings.</p>`}
    <div class="hof-awards">${snap.awards.map(a => `<div class="hof-award">
      <div class="hof-award-head"><span class="hof-award-emoji" aria-hidden="true">${a.emoji}</span><span class="hof-award-title">${escapeHtml(a.title)}</span></div>
      <div class="hof-award-desc">${escapeHtml(a.desc)}</div>
      ${a.winner ? `<div class="hof-award-win">${badgeFor(a.winner.playerId, 36)}<div><strong>${escapeHtml(a.winner.name)}</strong>${archived ? nowKnownAs(a.winner.playerId, a.winner.name) : ''}${a.winner.kidName ? ` <span class="muted" style="font-size:12px;">${escapeHtml(a.winner.kidName)}</span>` : ''}<div class="why">${escapeHtml(a.winner.why)}</div></div></div>`
                 : `<div class="hof-award-empty">${archived ? 'Nobody earned this one.' : 'Up for grabs. Nobody has earned this one yet.'}</div>`}
    </div>`).join('')}</div>`;

  const kings = `<h2 class="section-title" style="margin-top:24px;">👑 Category Kings</h2>
    ${archived ? '' : `<p class="muted" style="margin-top:-6px;">Who picked each draft-kit category the most. Just for bragging rights.</p>`}
    <div class="hof-kings">${snap.kings.map(k => `<div class="hof-king">${k.emoji} <b>${escapeHtml(k.category)}</b>
      <span>${k.winner ? `${escapeHtml(k.winner.name)}${archived ? nowKnownAs(k.winner.playerId, k.winner.name) : ''}: ${plural(k.winner.n, 'pick')}` : 'Nobody'}</span></div>`).join('')}</div>`;

  const recap = !archived ? '' : `<h2 class="section-title" style="margin-top:24px;">📋 Final standings &amp; player recaps</h2>
    <div class="hof-recap">${snap.standings.map(r => `<div class="hof-recap-row">
      <div class="hof-recap-rank">${r.rank}</div>
      <div class="hof-recap-main">
        <strong>${escapeHtml(r.name)}</strong>${archived ? nowKnownAs(r.playerId, r.name) : ''}${r.kidName ? ` <span class="muted" style="font-size:12px;">${escapeHtml(r.kidName)}</span>` : ''}
        <div class="hof-recap-line">${r.won} of ${r.decided} correct${r.decided ? ` (${Math.round(r.won / r.decided * 100)}%)` : ''}${r.favCategory ? ` · Favourite category: ${escapeHtml(r.favCategory)}` : ''}</div>
        ${r.topTeams.length ? `<div class="hof-recap-line">Most picked: ${r.topTeams.map(t => `${escapeHtml(t.team)} ×${t.n}`).join(', ')}</div>` : ''}
      </div>
      <div class="hof-recap-pts">${r.points}<small>PTS</small></div>
    </div>`).join('')}</div>`;

  return champ + minis + awards + kings + recap;
}

