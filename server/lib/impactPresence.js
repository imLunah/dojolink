// Which of a family's ninjas are at a desk right now, read off IMPACT's board,
// for the parent portal's "At the dojo until 5:46 pm".
//
// Only ever asked about one family's own children at the family's own center,
// and it answers with times and nothing else: no other ninja, no IMPACT ids,
// no names. A parent standing at the front desk could see as much.
//
// Parents poll, so the board is read at most once per TTL per center however
// many families are looking, and a failure of any kind is an empty answer:
// the status is a nicety and must never break the portal.

const impact = require('./impact');
const { readScanIns } = require('./impactSession');
const { matchStudents } = require('./impactRecord');

const TTL_MS = 20 * 1000;
const cache = new Map(); // locationId -> { at, rows }
const inflight = new Map();

async function boardRows(pool, locationId) {
  const hit = cache.get(locationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  if (!inflight.has(locationId)) {
    inflight.set(
      locationId,
      (async () => {
        const { rows } = await pool.query(
          `SELECT * FROM impact_connections WHERE location_id = $1 AND status = 'connected'`,
          [locationId]
        );
        const conn = rows[0];
        const scans = conn ? await readScanIns(pool, conn) : [];
        cache.set(locationId, { at: Date.now(), rows: scans });
        return scans;
      })().finally(() => inflight.delete(locationId))
    );
  }
  return inflight.get(locationId);
}

// studentIds -> { [studentId]: { startedAt, endsAt } } for those on the board.
async function familyAtDojo(pool, locationId, studentIds) {
  if (!studentIds.length) return {};
  let rows;
  try {
    rows = await boardRows(pool, locationId);
  } catch (err) {
    if (!(err instanceof impact.ImpactError || err instanceof impact.ImpactAuthError)) console.error('IMPACT presence failed:', err.message);
    return {};
  }
  // On the board: not hidden, not taken off it.
  const on = rows.filter((r) => r.userGuid && !r.hideFromDashboard && !r.dateTimeRemoved);
  if (!on.length) return {};
  const match = await matchStudents(
    pool,
    locationId,
    on.map((r) => ({ user: String(r.userGuid), name: `${r.firstName || ''} ${r.lastName || ''}` }))
  );
  const wanted = new Set(studentIds.map(Number));
  const out = {};
  for (const r of on) {
    const id = match.get(String(r.userGuid));
    if (id == null || !wanted.has(Number(id))) continue;
    const n = impact.normalizeScanIn(r);
    const started = new Date(n.startedAt);
    if (Number.isNaN(started.getTime())) continue;
    const endsAt = new Date(started.getTime() + n.sessionMinutes * 60000).toISOString();
    // A ninja scanned in twice today keeps the later session.
    if (!out[id] || out[id].startedAt < started.toISOString()) {
      out[id] = { startedAt: started.toISOString(), endsAt };
    }
  }
  return out;
}

module.exports = { familyAtDojo };
