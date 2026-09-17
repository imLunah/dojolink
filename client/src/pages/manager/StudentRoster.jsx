import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import { SearchIcon, UploadIcon, ArchiveRestoreIcon, Trash2Icon, XIcon } from 'lucide-react';
import IconAction from '../../components/ui/IconAction';
import Layout from '../../components/layout/Layout';
import ModalPortal from '../../components/ui/ModalPortal';
import BeltBadge from '../../components/ui/BeltBadge';
import ProgramBadge, { ProgramAvatar } from '../../components/ui/ProgramBadge';
import Button from '../../components/ui/Button';
import { api } from '../../api/client';
import { PROGRAMS, getBelt } from '../../utils/beltConfig';
import { formatDate } from '../../utils/dateUtils';
import { stickerUrl } from '../../utils/stickers';
import { useAuth } from '../../context/AuthContext';
import MyStudioImport from '../../components/manager/MyStudioImport';
import { CARD } from '../../lib/surfaces';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';


function parseProgram(membership) {
  if (!membership) return null;
  if (membership.includes('CODE NINJAS: CREATE')) return 'CREATE';
  if (membership.includes('CODE NINJAS: JR')) return 'JR';
  if (membership.includes('Robotics')) return 'Robotics Academy';
  if (membership.includes('AI')) return 'AI Academy';
  if (membership.includes('VR')) return 'VR Coding';
  return null;
}

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f59e0b',
];

function getAvatarColor(name) {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Roster avatar — Code.AI sticker when assigned, colored initials otherwise
function RosterAvatar({ student, className }) {
  const sticker = stickerUrl(student.codeorg_sticker);
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 text-white font-ninja font-bold overflow-hidden ${className}`}
      style={sticker
        ? { backgroundColor: '#fff', border: '1px solid #e2e8f0' }
        : { backgroundColor: getAvatarColor(student.full_name) }}
    >
      {sticker
        ? <img src={sticker} alt="" className="w-full h-full object-contain p-0.5" />
        : getInitials(student.full_name)}
    </div>
  );
}

const FILTER_CHIPS = [
  { label: 'All', value: '' },
  { label: 'CREATE', value: 'CREATE' },
  { label: 'Robotics Academy', value: 'Robotics Academy' },
  { label: 'AI Academy', value: 'AI Academy' },
  { label: 'JR', value: 'JR' },
  { label: 'VR Coding', value: 'VR Coding' },
];

const toggleInSet = (setter) => (id) => {
  setter((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};

const conflictKey = (c) => `${c.id}::${c.program}`;

export default function StudentRoster() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [programCounts, setProgramCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sort, setSort] = useState('last_active');

  const [showArchived, setShowArchived] = useState(false);

  // Bulk actions
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // CSV import
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  // Parsed rows held between the preview step and the confirmed import.
  const [pendingStudents, setPendingStudents] = useState(null);
  // Missing ninjas are removed by default — checking one KEEPS it.
  const [keepIds, setKeepIds] = useState(new Set());
  // Belt conflicts are NOT overridden by default; checking one applies the
  // CSV belt to that program only. Keyed by `${id}::${program}`.
  const [overrideKeys, setOverrideKeys] = useState(new Set());
  const [archiving, setArchiving] = useState(false);
  const fileInputRef = useRef(null);

  const toggleKeep = toggleInSet(setKeepIds);
  const toggleOverride = toggleInSet(setOverrideKeys);

  const totalRemoveCount = () => {
    const missing = importResult?.missing || [];
    return missing.filter((s) => !keepIds.has(s.id)).length;
  };
  const totalChangeCount = () => totalRemoveCount() + overrideKeys.size;

  const handleApply = async () => {
    const missing = importResult?.missing || [];
    const conflicts = importResult?.conflicts || [];
    const ids = missing.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    const updates = conflicts
      .filter((c) => overrideKeys.has(conflictKey(c)))
      .map((c) => ({ id: c.id, program: c.program, belt_level: c.new_belt }));
    if (ids.length === 0 && updates.length === 0) return;
    setArchiving(true);
    try {
      let removed = 0;
      if (updates.length) await api.post('/students/import/apply-belts', { updates });
      if (ids.length) {
        const result = await api.post('/students/bulk-archive', { ids });
        removed = result.archived;
      }
      setImportResult((prev) => ({ ...prev, missing: [], duplicates: [], conflicts: [], removed }));
      setKeepIds(new Set());
      setOverrideKeys(new Set());
      loadStudents();
    } catch (err) {
      setImportError(err.message || 'Could not apply changes');
    } finally {
      setArchiving(false);
    }
  };

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isReadOnly, viewAs } = useAuth();
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isReadOnly && !isSenseiView;
  const isLogMode = searchParams.get('mode') === 'log';

  const PAGE_SIZE = 25;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mobileSentinelRef = useRef(null);
  const desktopSentinelRef = useRef(null);

  const loadStudents = (offset = 0, append = false) => {
    if (append && loadingMore) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (programFilter) params.set('program', programFilter);
    params.set('sort', sort);
    params.set('limit', PAGE_SIZE);
    params.set('offset', offset);
    if (showArchived && isManager) params.set('inactive', 'true');
    if (append) setLoadingMore(true);
    else setLoading(true);
    api.get(`/students?${params.toString()}`)
      .then(({ students: page, total, programCounts: counts }) => {
        setStudents((prev) => append ? [...prev, ...page] : page);
        setTotalCount(total);
        if (counts && !showArchived) setProgramCounts(counts);
        setHasMore(page.length === PAGE_SIZE);
        if (!append) setSelected(new Set());
      })
      .catch(() => setError('Failed to load ninjas'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  };

  useEffect(() => { loadStudents(0); }, [search, programFilter, sort, showArchived, user?.activeLocation?.id]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadStudents(students.length, true);
        }
      },
      { rootMargin: '120px' }
    );

    if (mobileSentinelRef.current) observer.observe(mobileSentinelRef.current);
    if (desktopSentinelRef.current) observer.observe(desktopSentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, students.length]);

  const sorted = students;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Select-all covers EVERY ninja matching the current filters, not just the
  // loaded page (the roster is paginated 50 at a time).
  const toggleAll = async () => {
    if (selected.size >= totalCount && totalCount > 0) { setSelected(new Set()); return; }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (programFilter) params.set('program', programFilter);
    params.set('all', 'true');
    if (showArchived && isManager) params.set('inactive', 'true');
    try {
      const { students: allMatching } = await api.get(`/students?${params.toString()}`);
      setSelected(new Set((allMatching ?? []).map((s) => s.id)));
    } catch {
      setSelected(new Set(sorted.map((s) => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    setError('');
    const results = await Promise.allSettled([...selected].map((id) => api.delete(`/students/${id}`)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setDeleting(false);
    setConfirmDelete(false);
    setSelected(new Set());
    loadStudents();
    if (failed > 0) setError(`${failed} ninja${failed > 1 ? 's' : ''} could not be removed. Please try again.`);
  };

  const handleRestore = async (id) => {
    try {
      await api.patch(`/students/${id}/restore`, {});
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((c) => c - 1);
    } catch (err) {
      setError(err?.message || 'Failed to restore ninja');
    }
  };

  const [confirmPermanentId, setConfirmPermanentId] = useState(null);
  const handlePermanentDelete = async (id) => {
    try {
      await api.delete(`/students/${id}/permanent`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setTotalCount((c) => c - 1);
    } catch (err) {
      setError(err?.message || 'Failed to delete ninja');
    } finally {
      setConfirmPermanentId(null);
    }
  };

  const handleRowClick = (student) => {
    if (isLogMode) {
      const programs = (student.programs || []).map(p => p.program).join(',');
      navigate(`/sensei/student/${student.id}${programs ? `?programs=${encodeURIComponent(programs)}` : ''}`);
    } else {
      navigate(`/manager/students/${student.id}`);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportResult(null);
    setPendingStudents(null);
    setKeepIds(new Set());
    setOverrideKeys(new Set());
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const students = rows
          .map((row) => ({
            full_name: `${row['Participant First Name'] || ''} ${row['Participant Last Name'] || ''}`.trim(),
            birthday: row['Birthday'] || null,
            parent_name: `${row['Customer First Name'] || ''} ${row['Customer Last Name'] || ''}`.trim() || null,
            parent_email: row['Email']?.trim() || null,
            parent_phone: row['Mobile Phone']?.trim() || null,
            program: parseProgram(row['Membership']),
            belt_raw: row['Rank'] || null,
          }))
          // Keep every named row, even when the program doesn't parse. Rows with
          // no program are skipped on insert server-side, but their presence
          // still protects an existing ninja from being flagged "missing" and
          // archived (which was silently deleting advanced-program kids).
          .filter((s) => s.full_name);

        if (students.length === 0) {
          setImportError('No valid students found in this file. Make sure it\'s a MyStudio export.');
          setImporting(false);
          return;
        }

        try {
          // Preview only — nothing is written until the user confirms.
          const result = await api.post('/students/import', { students, dryRun: true });
          setImportResult(result);
          setPendingStudents(students);
        } catch (err) {
          setImportError(err.message || 'Import failed');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: () => {
        setImportError('Failed to read CSV file.');
        setImporting(false);
      },
    });
  };

  // Commit the previewed import for real, then surface the post-import
  // summary + missing/conflict apply step.
  const handleConfirmImport = async () => {
    if (!pendingStudents) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await api.post('/students/import', { students: pendingStudents });
      setImportResult(result);
      setPendingStudents(null);
      loadStudents();
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const chipCounts = FILTER_CHIPS.reduce((acc, chip) => {
    acc[chip.value] = chip.value
      ? (programCounts[chip.value] ?? 0)
      : totalCount;
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-4 lg:h-[calc(100dvh-64px)] lg:flex lg:flex-col lg:space-y-0 lg:gap-4">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-ninja text-ninja-navy leading-tight">
              {isLogMode ? 'Log Progress' : showArchived ? 'Archived Ninjas' : 'Ninjas'}
            </h1>
            <p className="text-ninja-muted font-ninja text-sm mt-0.5">
              {isLogMode
                ? 'Pick a ninja to log a session'
                : showArchived
                ? `${totalCount} archived ninja${totalCount !== 1 ? 's' : ''}`
                : `${totalCount} active ninja${totalCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          {isManager && !isLogMode && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={() => { setShowArchived((v) => !v); setSelected(new Set()); setSearch(''); setProgramFilter(''); }}
              >
                {showArchived ? 'Active Ninjas' : 'Archived'}
              </Button>
              {!showArchived && (
                <>
                  <Button variant="secondary" onClick={() => { setImportModal(true); setImportResult(null); setImportError(''); setPendingStudents(null); setKeepIds(new Set()); setOverrideKeys(new Set()); }}>
                    Import CSV
                  </Button>
                  {/* Beside the CSV rather than instead of it: a roster is not
                      something to have only one way of loading, and this one
                      depends on an undocumented vendor API. It renders nothing
                      unless this center is connected and wants it, which is
                      the connection's own feature_import flag and not a
                      preference belonging to whoever is looking. */}
                  <MyStudioImport onImported={() => loadStudents(0)} />
                  <Button onClick={() => navigate('/manager/students/new')}>+ Add Ninja</Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Mobile: search + chips ── */}
        <div className="lg:hidden space-y-2.5">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ninja-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search ninjas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-xl pl-9 pr-4 py-2.5 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setProgramFilter(chip.value)}
                className={`flex-shrink-0 text-sm font-ninja font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                  programFilter === chip.value
                    ? 'bg-ninja-blue text-white border-ninja-blue'
                    : 'bg-white text-ninja-navy border-ninja-border hover:border-ninja-blue'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mobile list ── */}
        <div className="lg:hidden bg-white border border-ninja-border rounded-xl overflow-clip shadow-sm">
          {error && <p className="text-ninja-red font-ninja text-center py-8">{error}</p>}
          {loading && <SkeletonList rows={6} label="Loading ninjas" />}
          {!loading && !error && (
            <div className="divide-y divide-ninja-border/50">
              {sorted.length === 0 && (
                <p className="text-center text-ninja-muted font-ninja py-12">No ninjas found</p>
              )}
              {sorted.map((s, i) => {
                const create = (s.programs || []).find((p) => p.program === 'CREATE');
                const belt = create?.belt_level ? getBelt(create.belt_level) : null;
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.25, ease: 'easeOut' }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ninja-bg transition-colors"
                    onClick={() => handleRowClick(s)}
                  >
                    <RosterAvatar student={s} className="w-10 h-10 text-sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-ninja font-bold text-ninja-navy truncate">{s.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {(s.programs || []).map((p) => (
                          <ProgramAvatar key={p.program} program={p.program} size="xs" />
                        ))}
                      </div>
                    </div>
                    {belt && (
                      <span
                        className="flex-shrink-0 text-xs font-ninja font-bold px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: belt.color,
                          color: belt.textColor,
                          border: belt.name === 'White' ? '1.5px solid #d1d5db' : 'none',
                        }}
                      >
                        {belt.name} #{create.belt_sublevel}
                      </span>
                    )}
                    {isLogMode && (
                      <span className="text-ninja-blue font-ninja font-bold text-xs flex-shrink-0">Log →</span>
                    )}
                    {showArchived && isManager && (
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {confirmPermanentId === s.id ? (
                          <>
                            <button onClick={() => handlePermanentDelete(s.id)} className="text-xs font-ninja font-semibold text-white bg-ninja-red rounded-lg px-2 py-1">Yes, delete</button>
                            <IconAction onClick={() => setConfirmPermanentId(null)} label="Keep ninja">
                              <XIcon className="w-4 h-4" strokeWidth={2.25} />
                            </IconAction>
                          </>
                        ) : (
                          <>
                            <IconAction onClick={() => handleRestore(s.id)} label={`Restore ${s.full_name}`} tone="positive">
                              <ArchiveRestoreIcon className="w-4 h-4" strokeWidth={2} />
                            </IconAction>
                            <IconAction onClick={() => setConfirmPermanentId(s.id)} label={`Delete ${s.full_name} forever`} tone="danger">
                              <Trash2Icon className="w-4 h-4" strokeWidth={2} />
                            </IconAction>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
          <div ref={mobileSentinelRef} className="h-1" />
          {loadingMore && (
            <div role="status" aria-busy="true" aria-label="Loading more ninjas" className="py-3 space-y-2"><Skeleton className="h-3.5 w-1/2 mx-auto" /><Skeleton className="h-3.5 w-1/3 mx-auto" /></div>
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:gap-3">
          {/* Filter + sort bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ninja-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white border border-ninja-border text-ninja-navy rounded-lg pl-8 pr-3 py-1.5 font-ninja text-sm focus:outline-none focus:border-ninja-blue transition-colors w-44"
              />
            </div>

            {/* Program filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setProgramFilter(chip.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-ninja font-bold text-xs border transition-colors ${
                    programFilter === chip.value
                      ? 'bg-ninja-blue text-white border-ninja-blue'
                      : 'bg-white text-ninja-navy border-ninja-border hover:border-ninja-blue'
                  }`}
                >
                  {chip.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    programFilter === chip.value ? 'bg-white/25 text-white' : 'bg-ninja-bg text-ninja-muted'
                  }`}>
                    {chipCounts[chip.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Sort */}
            <span className="font-ninja text-sm text-ninja-muted">
              Sort:{' '}
              <button
                className="font-bold text-ninja-navy hover:text-ninja-blue transition-colors"
                onClick={() => setSort(sort === 'last_active' ? 'name' : sort === 'name' ? 'joined' : 'last_active')}
              >
                {sort === 'last_active' ? 'Last session ↓' : sort === 'name' ? 'Name A–Z' : 'Newest first'}
              </button>
            </span>
          </div>

          {/* Table card */}
          <div className={`${CARD} overflow-hidden flex flex-col flex-1 min-h-0`}>
            {error && <p className="text-ninja-red font-ninja text-center py-8">{error}</p>}
            {loading && <SkeletonList rows={6} label="Loading ninjas" />}
            {!loading && !error && (
              <>
                {/* Table head — stays pinned, rows scroll below */}
                {!showArchived && selected.size > 0 ? (
                  <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-ninja-border bg-ninja-bg">
                    <label className="inline-flex items-center gap-3 font-ninja font-bold text-sm text-ninja-navy">
                      <input
                        type="checkbox"
                        checked={totalCount > 0 && selected.size >= totalCount}
                        onChange={toggleAll}
                        className="rounded border-ninja-border accent-ninja-blue cursor-pointer"
                      />
                      {selected.size} selected
                    </label>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {confirmDelete ? (
                        <>
                          <span className="font-ninja text-sm font-semibold text-ninja-muted">
                            Move to archive?
                          </span>
                          <Button size="sm" variant="danger" onClick={handleDeleteSelected} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                            Clear
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`flex-shrink-0 grid gap-4 px-5 py-3.5 border-b border-ninja-border bg-ninja-bg font-ninja font-bold text-xs text-ninja-muted uppercase tracking-widest ${isManager && !isLogMode ? 'grid-cols-[28px_2fr_1.5fr_1.4fr_1fr_80px]' : 'grid-cols-[2fr_1.5fr_1.4fr_1fr_80px]'}`}>
                    {isManager && !isLogMode && (
                      <div>
                        <input
                          type="checkbox"
                          checked={totalCount > 0 && selected.size >= totalCount}
                          onChange={toggleAll}
                          className="rounded border-ninja-border accent-ninja-blue cursor-pointer"
                        />
                      </div>
                    )}
                    <div>Name</div>
                    <div>Programs</div>
                    <div>Belt</div>
                    <div>Last session</div>
                    <div />
                  </div>
                )}

                {/* Rows — scrollable */}
                <div className="overflow-y-auto flex-1">
                {sorted.length === 0 && (
                  <p className="text-center text-ninja-muted font-ninja py-12">No ninjas found</p>
                )}
                {sorted.map((s, i) => {
                  const create = (s.programs || []).find((p) => p.program === 'CREATE');
                  const isSelected = selected.has(s.id);
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.22, ease: 'easeOut' }}
                      onClick={() => handleRowClick(s)}
                      className={`grid gap-4 px-5 py-3.5 items-center cursor-pointer transition-colors border-b border-ninja-border/60 last:border-b-0 ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-ninja-bg'
                      } ${isManager && !isLogMode ? 'grid-cols-[28px_2fr_1.5fr_1.4fr_1fr_80px]' : 'grid-cols-[2fr_1.5fr_1.4fr_1fr_80px]'}`}
                    >
                      {isManager && !isLogMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(s.id)}
                            className="rounded border-ninja-border accent-ninja-blue cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Name + avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        <RosterAvatar student={s} className="w-8 h-8 text-xs" />
                        <span className="font-ninja font-bold text-ninja-navy text-sm truncate">{s.full_name}</span>
                      </div>

                      {/* Programs */}
                      <div className="flex items-center gap-1.5">
                        {(s.programs || []).map((p) => (
                          <ProgramAvatar key={p.program} program={p.program} size="xs" />
                        ))}
                        {(s.programs || []).length === 0 && (
                          <span className="text-ninja-muted font-ninja text-sm italic">—</span>
                        )}
                      </div>

                      {/* Belt */}
                      <div>
                        {create?.belt_level
                          ? <BeltBadge belt={create.belt_level} sublevel={create.belt_sublevel} size="xs" />
                          : <span className="text-ninja-muted font-ninja text-sm">—</span>
                        }
                      </div>

                      {/* Last session */}
                      <div className="font-ninja text-sm text-ninja-navy font-semibold">
                        {s.last_activity ? formatDate(s.last_activity) : <span className="text-ninja-muted font-normal">Never</span>}
                      </div>

                      {/* Action */}
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        {isLogMode ? (
                          <button
                            onClick={() => handleRowClick(s)}
                            className="text-xs font-ninja font-bold text-ninja-blue border border-ninja-blue rounded-lg px-3 py-1.5 hover:bg-ninja-blue hover:text-white transition-colors"
                          >
                            Log
                          </button>
                        ) : (showArchived && isManager) ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {confirmPermanentId === s.id ? (
                              <>
                                <span className="text-ninja-red font-ninja text-xs">Delete?</span>
                                <button onClick={() => handlePermanentDelete(s.id)} className="text-xs font-ninja font-semibold text-white bg-ninja-red rounded-lg px-2 py-1 hover:opacity-90">Yes</button>
                                <IconAction onClick={() => setConfirmPermanentId(null)} label="Keep ninja">
                                  <XIcon className="w-4 h-4" strokeWidth={2.25} />
                                </IconAction>
                              </>
                            ) : (
                              <>
                                <IconAction onClick={() => handleRestore(s.id)} label={`Restore ${s.full_name}`} tone="positive">
                                  <ArchiveRestoreIcon className="w-4 h-4" strokeWidth={2} />
                                </IconAction>
                                <IconAction onClick={() => setConfirmPermanentId(s.id)} label={`Delete ${s.full_name} forever`} tone="danger">
                                  <Trash2Icon className="w-4 h-4" strokeWidth={2} />
                                </IconAction>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-ninja-muted text-lg cursor-pointer hover:text-ninja-navy transition-colors">···</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={desktopSentinelRef} className="h-1" />
                {loadingMore && (
                  <div role="status" aria-busy="true" aria-label="Loading more ninjas" className="py-3 space-y-2"><Skeleton className="h-3.5 w-1/2 mx-auto" /><Skeleton className="h-3.5 w-1/3 mx-auto" /></div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {importModal && (
        <ModalPortal><div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold font-ninja text-ninja-navy mb-1">Import from MyStudio CSV</h2>
            <p className="text-ninja-muted font-ninja text-sm mb-5">
              Export your membership list from MyStudio and upload it here. Programs and belt levels are auto-detected.
            </p>

            {!importResult && (
              <>
                {importError && (
                  <div className="bg-red-50 border border-red-200 text-ninja-red rounded-lg p-3 mb-4 text-sm font-ninja">
                    {importError}
                  </div>
                )}
                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-ninja-border rounded-xl p-8 cursor-pointer hover:border-ninja-blue transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <UploadIcon className="w-8 h-8 text-ninja-muted mb-2" strokeWidth={1.5} />
                  <span className="text-ninja-muted font-ninja text-sm">{importing ? 'Importing...' : 'Click to select CSV file'}</span>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </label>
              </>
            )}

            {importResult?.preview && (
              <div className="space-y-3">
                {importError && (
                  <div className="bg-red-50 border border-red-200 text-ninja-red rounded-lg p-3 text-sm font-ninja">
                    {importError}
                  </div>
                )}
                <div className="bg-ninja-bg border border-ninja-border rounded-lg p-3">
                  {importResult.added_students?.length > 0 ? (
                    <details className="group" open>
                      <summary className="text-ninja-navy font-ninja font-semibold text-sm cursor-pointer list-none flex items-center gap-1">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        {importResult.added} ninja{importResult.added !== 1 ? 's' : ''} will be added
                      </summary>
                      <ul className="text-ninja-navy font-ninja text-sm mt-2 pl-4 space-y-1 max-h-44 overflow-y-auto">
                        {importResult.added_students.map((s) => (
                          <li key={`${s.full_name}-${s.program}`} className="flex items-center gap-2">
                            <span>{s.full_name}</span>
                            <ProgramBadge program={s.program} size="xs" />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="text-ninja-navy font-ninja font-semibold text-sm">
                      No new ninjas to add.
                    </p>
                  )}
                  {importResult.duplicates?.length > 0 && (
                    <details className="mt-1 group">
                      <summary className="text-ninja-muted font-ninja text-sm cursor-pointer list-none flex items-center gap-1">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        {importResult.duplicates.length} already enrolled (will be skipped)
                      </summary>
                      <ul className="text-ninja-navy font-ninja text-sm mt-2 pl-4 space-y-1 max-h-44 overflow-y-auto">
                        {importResult.duplicates.map((s) => (
                          <li key={s.id}>{s.full_name}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {(importResult.conflicts?.length > 0 || importResult.missing?.length > 0) && (
                  <p className="text-ninja-muted font-ninja text-xs px-1">
                    {importResult.conflicts?.length > 0 && `${importResult.conflicts.length} belt change${importResult.conflicts.length !== 1 ? 's' : ''}`}
                    {importResult.conflicts?.length > 0 && importResult.missing?.length > 0 && ' and '}
                    {importResult.missing?.length > 0 && `${importResult.missing.length} roster ninja${importResult.missing.length !== 1 ? 's' : ''} not in this CSV`}
                    {' '}to review after confirming.
                  </p>
                )}
              </div>
            )}

            {importResult && !importResult.preview && (
              <div className="space-y-3">
                <div className="bg-ninja-bg border border-ninja-border rounded-lg p-3">
                  {importResult.added_students?.length > 0 ? (
                    <details className="group" open>
                      <summary className="text-ninja-navy font-ninja font-semibold text-sm cursor-pointer list-none flex items-center gap-1">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        {importResult.added} ninja{importResult.added !== 1 ? 's' : ''} imported successfully
                      </summary>
                      <ul className="text-ninja-navy font-ninja text-sm mt-2 pl-4 space-y-1 max-h-44 overflow-y-auto">
                        {importResult.added_students.map((s) => (
                          <li key={`${s.id}-${s.program}`} className="flex items-center gap-2">
                            <span>{s.full_name}</span>
                            <ProgramBadge program={s.program} size="xs" />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="text-ninja-navy font-ninja font-semibold text-sm">
                      {importResult.added} ninja{importResult.added !== 1 ? 's' : ''} imported successfully
                    </p>
                  )}
                  {importResult.removed > 0 && (
                    <p className="text-ninja-navy font-ninja text-sm mt-1">
                      {importResult.removed} ninja{importResult.removed !== 1 ? 's' : ''} removed from the roster
                    </p>
                  )}
                  {importResult.duplicates?.length > 0 && (
                    <details className="mt-1 group">
                      <summary className="text-ninja-muted font-ninja text-sm cursor-pointer list-none flex items-center gap-1">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        {importResult.duplicates.length} already enrolled (skipped, no change)
                      </summary>
                      <ul className="text-ninja-navy font-ninja text-sm mt-2 pl-4 space-y-1 max-h-44 overflow-y-auto">
                        {importResult.duplicates.map((s) => (
                          <li key={s.id}>{s.full_name}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {importResult.conflicts?.length > 0 && (
                  <div className="bg-ninja-bg border border-ninja-border rounded-lg p-3">
                    <p className="text-ninja-navy font-ninja font-semibold text-sm mb-1">
                      {importResult.conflicts.length} belt change{importResult.conflicts.length !== 1 ? 's' : ''} found in this CSV
                    </p>
                    <p className="text-ninja-muted font-ninja text-xs mb-2">
                      Check any you want to update. Only that program's belt changes; other programs are left alone.
                    </p>
                    <button
                      type="button"
                      onClick={() => setOverrideKeys(
                        overrideKeys.size === importResult.conflicts.length
                          ? new Set()
                          : new Set(importResult.conflicts.map((c) => conflictKey(c)))
                      )}
                      className="text-ninja-blue font-ninja text-xs font-semibold hover:underline mb-2"
                    >
                      {overrideKeys.size === importResult.conflicts.length ? 'Clear all' : 'Select all'}
                    </button>
                    <ul className="text-ninja-navy font-ninja text-sm space-y-1 max-h-44 overflow-y-auto">
                      {importResult.conflicts.map((c) => {
                        const key = conflictKey(c);
                        return (
                          <li key={key}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={overrideKeys.has(key)}
                                onChange={() => toggleOverride(key)}
                                className="accent-ninja-blue"
                              />
                              <span className={overrideKeys.has(key) ? '' : 'text-ninja-muted'}>
                                {c.full_name} <span className="text-ninja-muted">({c.program})</span>: {c.current_belt || 'None'} → <span className="font-semibold">{c.new_belt}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {importResult.missing?.length > 0 && (
                  <div className="bg-ninja-bg border border-ninja-border rounded-lg p-3">
                    <p className="text-ninja-navy font-ninja font-semibold text-sm mb-1">
                      {importResult.missing.length} ninja{importResult.missing.length !== 1 ? 's are' : ' is'} on the roster but not in this CSV
                    </p>
                    <p className="text-ninja-muted font-ninja text-xs mb-2">
                      These will be removed (archived) unless you check them to keep.
                    </p>
                    <button
                      type="button"
                      onClick={() => setKeepIds(
                        keepIds.size === importResult.missing.length
                          ? new Set()
                          : new Set(importResult.missing.map((s) => s.id))
                      )}
                      className="text-ninja-blue font-ninja text-xs font-semibold hover:underline mb-2"
                    >
                      {keepIds.size === importResult.missing.length ? 'Clear all' : 'Select all'}
                    </button>
                    <ul className="text-ninja-navy font-ninja text-sm space-y-1 max-h-44 overflow-y-auto">
                      {importResult.missing.map((s) => (
                        <li key={s.id}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={keepIds.has(s.id)}
                              onChange={() => toggleKeep(s.id)}
                              className="accent-green-600"
                            />
                            <span className={keepIds.has(s.id) ? '' : 'text-ninja-muted line-through'}>{s.full_name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              {importResult?.preview ? (
                <>
                  <Button variant="secondary" onClick={() => setImportModal(false)} disabled={importing}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={importing || (importResult.added === 0 && !importResult.conflicts?.length && !importResult.missing?.length)}
                    className="ml-auto"
                  >
                    {importing ? 'Importing…' : `Confirm Import${importResult.added ? ` (${importResult.added})` : ''}`}
                  </Button>
                </>
              ) : (importResult?.missing?.length > 0 || importResult?.conflicts?.length > 0) ? (
                <>
                  <Button variant="secondary" onClick={() => setImportModal(false)} disabled={archiving}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={archiving || totalChangeCount() === 0}
                    className="ml-auto"
                  >
                    {archiving ? 'Applying…' : `Apply Changes${totalChangeCount() ? ` (${totalChangeCount()})` : ''}`}
                  </Button>
                </>
              ) : (
                <>
                  {importResult && !importing && (
                    <Button variant="secondary" onClick={() => { setImportResult(null); setImportError(''); setPendingStudents(null); setKeepIds(new Set()); setOverrideKeys(new Set()); }}>
                      Import Another
                    </Button>
                  )}
                  <Button variant={importResult ? 'primary' : 'secondary'} onClick={() => setImportModal(false)} className="ml-auto">
                    {importResult ? 'Done' : 'Cancel'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div></ModalPortal>
      )}
    </Layout>
  );
}
