import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/layout/Layout';
import { api } from '../../api/client';
import { CARD } from '../../lib/surfaces';
import { SkeletonList } from '../../components/ui/Skeleton';

const ADMIN_NAV_LINKS = [
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/parents', label: 'Parents' },
  { to: '/admin/curriculum', label: 'Curriculum' },
  { to: '/admin/settings', label: 'Settings' },
];

function AdminNav() {
  const path = window.location.pathname;
  const links = ADMIN_NAV_LINKS;
  return (
    <div className="flex items-center gap-4 mb-6 border-b border-ninja-border pb-4">
      {links.map((l) => (
        <a
          key={l.to}
          href={l.to}
          className={`font-ninja text-sm font-semibold transition-colors ${
            path === l.to
              ? 'text-ninja-navy border-b-2 border-ninja-blue pb-0.5'
              : 'text-ninja-muted hover:text-ninja-navy'
          }`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

// The order is how far along a family is, most done first. Mirrors the CASE in
// GET /api/admin/parents.
const STATUSES = [
  { key: 'signed_up', label: 'Signed up', dot: 'bg-green-500' },
  { key: 'started', label: 'Signed in, not finished', dot: 'bg-amber-500' },
  { key: 'not_signed_in', label: 'Not signed in', dot: 'bg-gray-400' },
  { key: 'no_email', label: 'No email on file', dot: 'bg-ninja-red' },
];
const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// The date that goes with the state. A sign-in with no date is one recorded
// before sign-ins were, so it says nothing rather than guessing.
function whenLabel(p) {
  if (p.status === 'signed_up') return `on ${formatDate(p.signed_up_at)}`;
  if (p.status === 'started' && p.last_signed_in_at) return `last ${formatDate(p.last_signed_in_at)}`;
  return '';
}

function StatusLabel({ p }) {
  const s = STATUS_BY_KEY[p.status];
  const when = whenLabel(p);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <span className="font-ninja text-sm text-ninja-navy">{s.label}</span>
      {when && <span className="font-ninja text-xs text-ninja-muted whitespace-nowrap">{when}</span>}
    </div>
  );
}

export default function ParentsPage() {
  const [parents, setParents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/locations').then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/admin/parents${filterLocation ? `?location_id=${filterLocation}` : ''}`)
      .then(setParents)
      .catch(() => setError('Failed to load parents'))
      .finally(() => setLoading(false));
  }, [filterLocation]);

  const counts = useMemo(() => {
    const c = {};
    for (const p of parents) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [parents]);

  const shown = filterStatus ? parents.filter((p) => p.status === filterStatus) : parents;
  const showCenter = !filterLocation && locations.length > 1;
  const cols = showCenter ? 'grid-cols-[1.6fr_1.6fr_1fr_1.6fr]' : 'grid-cols-[1.6fr_1.6fr_1.6fr]';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <AdminNav />

        <div className="mb-6">
          <h1 className="text-ninja-navy font-ninja font-bold text-2xl">Parents</h1>
          <p className="text-ninja-muted font-ninja text-sm mt-0.5">Which families have signed up for the parent portal</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
          >
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
          >
            <option value="">All families ({parents.length})</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({counts[s.key] || 0})</option>
            ))}
          </select>
        </div>

        {error && <p className="text-ninja-red font-ninja text-sm mb-4">{error}</p>}

        {loading ? (
          <SkeletonList rows={8} label="Loading parents" />
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            {shown.length === 0 ? (
              <p className="text-ninja-muted font-ninja text-center py-12">No families found.</p>
            ) : (
              <>
                <div className={`hidden lg:grid ${cols} gap-4 px-5 py-3 border-b border-ninja-border bg-ninja-bg font-ninja font-bold text-xs text-ninja-muted uppercase tracking-widest`}>
                  <div>Parent</div>
                  <div>Ninjas</div>
                  {showCenter && <div>Center</div>}
                  <div>Status</div>
                </div>
                {shown.map((p) => {
                  const key = `${p.location_id}-${p.email || p.ninjas.join('|')}`;
                  const name = p.parent_name || 'No name on file';
                  return (
                    <div key={key}>
                      {/* Desktop row */}
                      <div className={`hidden lg:grid ${cols} gap-4 px-5 py-3.5 items-center border-b border-ninja-border/60 last:border-b-0`}>
                        <div className="min-w-0">
                          <p className="font-ninja font-semibold text-ninja-navy text-sm truncate">{name}</p>
                          {p.email && <p className="font-ninja text-xs text-ninja-muted truncate" title={p.email}>{p.email}</p>}
                        </div>
                        <p className="font-ninja text-sm text-ninja-navy truncate" title={p.ninjas.join(', ')}>{p.ninjas.join(', ')}</p>
                        {showCenter && <p className="font-ninja text-sm text-ninja-navy truncate">{p.location_name}</p>}
                        <StatusLabel p={p} />
                      </div>
                      {/* Mobile card */}
                      <div className="lg:hidden px-4 py-3.5 border-b border-ninja-border/60 last:border-b-0">
                        <p className="font-ninja font-semibold text-ninja-navy text-sm leading-snug">{name}</p>
                        {p.email && <p className="font-ninja text-xs text-ninja-muted break-all">{p.email}</p>}
                        <p className="font-ninja text-xs text-ninja-muted mt-1 mb-1.5">
                          {p.ninjas.join(', ')}{showCenter ? ` · ${p.location_name}` : ''}
                        </p>
                        <StatusLabel p={p} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
