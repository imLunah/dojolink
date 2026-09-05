import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BirthdayConfetti, { isBirthdayToday } from '../../components/shared/BirthdayConfetti';
import RoadmapModal from '../../components/shared/RoadmapModal';
import { motion } from 'framer-motion';
import { MapIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/layout/Layout';
import BeltIcon from '../../components/ui/BeltIcon';
import Button from '../../components/ui/Button';
import ProgressHistory from '../../components/shared/ProgressHistory';
import PinnedNote from '../../components/shared/PinnedNote';
import EditStudentModal from '../../components/manager/EditStudentModal';
import StickerPickerModal from '../../components/shared/StickerPickerModal';
import { stickerUrl, stickerLabel } from '../../utils/stickers';
import { api } from '../../api/client';
import { BELTS, getMaxLevel, getLevels, getBelt, PROGRAM_LOGOS } from '../../utils/beltConfig';
import { SkeletonProfile } from '../../components/ui/Skeleton';

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#6366f1','#f59e0b',
];
function getAvatarColor(name) {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar circle — shows the ninja's Code.AI sticker when one is assigned,
// otherwise colored initials. Tappable (with a + badge when empty) for
// JR-enrolled ninjas so staff can assign the sticker.
function StudentAvatar({ student, size = 'md', canEditSticker, onEditSticker, delay = 0.15 }) {
  const sticker = stickerUrl(student.codeorg_sticker);
  const circle = (
    <motion.div
      className={`rounded-full flex items-center justify-center text-white font-ninja font-bold flex-shrink-0 overflow-hidden ${size === 'lg' ? 'w-16 h-16 text-xl' : 'w-14 h-14 text-lg'}`}
      style={sticker
        ? { backgroundColor: '#fff', border: '1px solid #e2e8f0' }
        : { backgroundColor: getAvatarColor(student.full_name) }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 260, delay }}
    >
      {sticker
        ? <img src={sticker} alt={`${stickerLabel(student.codeorg_sticker)} sticker`} className="w-full h-full object-contain p-1" />
        : getInitials(student.full_name)}
    </motion.div>
  );

  if (!canEditSticker) return circle;
  return (
    <button
      type="button"
      onClick={onEditSticker}
      className="relative flex-shrink-0"
      title="Code.AI sticker"
      aria-label="Set Code.AI sticker"
    >
      {circle}
      {!sticker && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-ninja-blue text-white flex items-center justify-center text-xs font-bold leading-none border-2 border-white">
          +
        </span>
      )}
    </button>
  );
}

// ── Mobile: Belt Journey card ─────────────────────────────────────────────────
function MobileBeltJourney({ enrollment }) {
  const { belt_level, belt_sublevel, current_project, project_status } = enrollment;
  const belt = getBelt(belt_level);
  const maxLevel = getMaxLevel(belt_level);
  const _levels = getLevels(belt_level);
  const _pos = belt_sublevel != null ? _levels.indexOf(parseInt(belt_sublevel)) : -1;
  // "% to next belt" = sublevels actually completed. The current sublevel only
  // counts once its project is Completed — otherwise the top sublevel would read
  // 100% while still Working On (see Joel Shelton, White #4 of 4 Working On).
  const _done = _pos >= 0 ? _pos + (project_status === 'Completed' ? 1 : 0) : -1;
  const progress = _levels.length && _pos >= 0 ? Math.round((_done / _levels.length) * 100) : null;
  const beltIdx = BELTS.findIndex(b => b.name === belt_level);
  const currentIconRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current && currentIconRef.current) {
      const container = scrollRef.current;
      const icon = currentIconRef.current;
      const containerRect = container.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const scrollTo = container.scrollLeft + iconRect.left - containerRect.left - containerRect.width / 2 + iconRect.width / 2;
      container.scrollLeft = Math.max(0, scrollTo);
    }
  }, [beltIdx]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-ninja-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={PROGRAM_LOGOS['CREATE']} alt="CREATE" className="w-9 h-9 object-contain flex-shrink-0" />
          <h2 className="font-ninja font-bold text-ninja-navy">Belt Journey</h2>
        </div>
        {maxLevel && (
          <span className="text-ninja-muted font-ninja text-sm">
            {belt_level} #{belt_sublevel} of {maxLevel}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="overflow-x-auto -mx-4 px-4 no-scrollbar">
        <div className="flex items-center" style={{ minWidth: 'max-content' }}>
          {BELTS.map((b, i) => {
            const isCurrent = i === beltIdx;
            const isPast = i < beltIdx;
            const size = isCurrent ? 52 : 36;
            return (
              <React.Fragment key={b.name}>
                {i > 0 && (
                  <div className="h-0.5 flex-shrink-0" style={{ width: 16, backgroundColor: i <= beltIdx ? 'rgb(var(--ninja-blue))' : '#e2e8f0' }} />
                )}
                <div
                  ref={isCurrent ? currentIconRef : null}
                  className="relative flex-shrink-0"
                  style={{ width: size, height: size }}
                >
                  <BeltIcon belt={b.name} size={size} dimmed={!isPast && !isCurrent} className="w-full h-full" />
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex mt-1" style={{ minWidth: 'max-content' }}>
          {BELTS.map((b, i) => {
            const isCurrent = i === beltIdx;
            const size = isCurrent ? 52 : 36;
            return (
              <React.Fragment key={b.name}>
                {i > 0 && <div className="flex-shrink-0" style={{ width: 16 }} />}
                <div className="flex justify-center flex-shrink-0" style={{ width: size }}>
                  <span className={`font-ninja text-[10px] leading-none ${isCurrent ? 'font-bold text-ninja-navy' : 'text-ninja-muted'}`}>
                    {b.name}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {progress !== null && (
        <div className="mt-3">
          <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: belt?.color || 'rgb(var(--ninja-blue))' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-ninja-muted font-ninja text-xs">
              {current_project ? `Current project: ${current_project}` : ''}
            </span>
            <span className="font-ninja font-bold text-xs text-ninja-navy">{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

const PROGRAM_CARD_GRADIENTS = {
  'Robotics Academy': 'linear-gradient(135deg, #060d1a 0%, #0a1e3d 55%, #0d3070 100%)',
  'AI Academy':       'linear-gradient(135deg, #060c1f 0%, #091840 55%, #0e2a7a 100%)',
  'JR':               'linear-gradient(135deg, #1a0533 0%, #2d1267 55%, #4c1d95 100%)',
  'VR Coding':        'linear-gradient(135deg, #04181c 0%, #073a40 55%, #0b5e63 100%)',
};
const PROGRAM_CARD_BAR_COLORS = {
  'Robotics Academy': '#2563eb',
  'AI Academy':       '#1d4ed8',
  'JR':               '#7c3aed',
  'VR Coding':        '#14b8a6',
};

// ── Mobile: Non-CREATE program card ──────────────────────────────────────────
function MobileProgramCard({ enrollment, onOpenRoadmap }) {
  const { program, percent_complete, last_sub_program, last_module_name, last_lesson_name, last_session_date } = enrollment;
  const gradient = PROGRAM_CARD_GRADIENTS[program] || 'linear-gradient(135deg, #0f172a, #1e293b)';
  const barColor = PROGRAM_CARD_BAR_COLORS[program] || 'rgb(var(--ninja-blue))';

  return (
    <div className="rounded-2xl overflow-hidden border border-ninja-border shadow-sm">
      {/* Hero banner */}
      <div style={{ background: gradient, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.div
          style={{ flex: 1, minWidth: 0 }}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3, fontFamily: 'Nunito, sans-serif' }}>
            Code Ninjas
          </p>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: 18, lineHeight: 1.1, fontFamily: 'Nunito, sans-serif' }}>
            {program}
          </h2>
          {last_session_date && (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3, fontFamily: 'Nunito, sans-serif' }}>
              Last: {new Date(String(last_session_date).split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </motion.div>
        {PROGRAM_LOGOS[program] && (
          <motion.img
            src={PROGRAM_LOGOS[program]}
            alt={program}
            initial={{ opacity: 0, scale: 0.7, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))' }}
          />
        )}
      </div>

      {/* Card body */}
      <div className="bg-white p-4">
        {last_sub_program && (
          <p className="text-ninja-muted font-ninja text-sm mb-1">
            <span className="font-semibold text-ninja-navy">Kit:</span> {last_sub_program}
          </p>
        )}
        {last_module_name && (
          <p className="text-ninja-muted font-ninja text-sm mb-1">
            <span className="font-semibold text-ninja-navy">Module:</span> {last_module_name}
            {last_lesson_name && <span> · {last_lesson_name}</span>}
          </p>
        )}
        {percent_complete != null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-ninja text-ninja-muted mb-1.5">
              <span>Module Progress</span>
              <motion.span
                className="font-bold text-ninja-navy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {Math.round(percent_complete)}%
              </motion.span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${percent_complete}%` }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              />
            </div>
          </div>
        )}
        <button
          onClick={onOpenRoadmap}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-ninja-blue font-ninja font-semibold text-sm py-2 rounded-xl border border-ninja-blue/25 hover:bg-ninja-blue/5 transition-colors"
        >
          <MapIcon className="w-4 h-4" />
          View Roadmap
        </button>
      </div>
    </div>
  );
}

// ── Mobile: Activity bar chart ────────────────────────────────────────────────
function MobileActivityChart({ logs }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  for (const log of logs) {
    const d = new Date(String(log.session_date).split('T')[0] + 'T00:00:00');
    const m = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (m) m.count++;
  }
  const max = Math.max(...months.map(m => m.count), 1);
  const BAR_HEIGHT = 52;

  return (
    <div className="flex items-end gap-2">
      {months.map((m, i) => (
        <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full flex flex-col justify-end" style={{ height: BAR_HEIGHT }}>
            <motion.div
              className="w-full rounded-t-md bg-ninja-blue"
              initial={{ height: 0 }}
              animate={{ height: m.count > 0 ? `${Math.max(6, Math.round((m.count / max) * BAR_HEIGHT))}px` : 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 + 0.25 }}
            />
          </div>
          <span className="text-ninja-muted font-ninja text-xs">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Desktop: Belt Journey card ─────────────────────────────────────────────────
function DesktopBeltJourney({ enrollment }) {
  const { belt_level, belt_sublevel, current_project, project_status } = enrollment;
  const belt = getBelt(belt_level);
  const maxLevel = getMaxLevel(belt_level);
  const _levels = getLevels(belt_level);
  const _pos = belt_sublevel != null ? _levels.indexOf(parseInt(belt_sublevel)) : -1;
  // Completed sublevels — current one counts only when its project is Completed.
  const _done = _pos >= 0 ? _pos + (project_status === 'Completed' ? 1 : 0) : -1;
  const progress = _levels.length && _pos >= 0 ? Math.round((_done / _levels.length) * 100) : null;
  const beltIdx = BELTS.findIndex((b) => b.name === belt_level);

  return (
    <div className="bg-white rounded-2xl p-5 border border-ninja-border shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <img src={PROGRAM_LOGOS['CREATE']} alt="CREATE" className="w-9 h-9 object-contain flex-shrink-0" />
          <h2 className="font-ninja font-bold text-ninja-navy">Belt Journey</h2>
        </div>
        {maxLevel && (
          <span className="text-ninja-muted font-ninja text-sm">
            {belt_level} #{belt_sublevel} of {maxLevel}
          </span>
        )}
      </div>

      {/* Icon + connector row */}
      <div className="flex items-center">
        {BELTS.map((b, i) => {
          const isCurrent = i === beltIdx;
          const isPast = i < beltIdx;
          const size = isCurrent ? 52 : 36;
          return (
            <React.Fragment key={b.name}>
              {i > 0 && (
                <div
                  className="h-0.5 flex-1"
                  style={{ backgroundColor: i <= beltIdx ? 'rgb(var(--ninja-blue))' : '#e2e8f0' }}
                />
              )}
              <div className="flex-shrink-0" style={{ width: size, height: size }}>
                <BeltIcon belt={b.name} dimmed={!isPast && !isCurrent} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* Label row */}
      <div className="flex mt-1.5">
        {BELTS.map((b, i) => {
          const isCurrent = i === beltIdx;
          const size = isCurrent ? 52 : 36;
          return (
            <React.Fragment key={b.name}>
              {i > 0 && <div className="flex-1" />}
              <div className="flex-shrink-0 flex justify-center" style={{ width: size }}>
                <span className={`font-ninja text-[10px] ${isCurrent ? 'font-bold text-ninja-navy' : 'text-ninja-muted'}`}>
                  {b.name}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {progress !== null && (
        <div className="mt-5">
          <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: belt?.color || 'rgb(var(--ninja-blue))' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-ninja-muted font-ninja text-sm">
              {current_project
                ? `Current project: ${current_project}${project_status ? `, ${project_status}` : ''}`
                : ''}
            </span>
            <span className="font-ninja font-bold text-sm text-ninja-navy">{progress}% to next belt</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Desktop: Activity bar chart ───────────────────────────────────────────────
function DesktopActivityChart({ logs }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  for (const log of logs) {
    const d = new Date(String(log.session_date).split('T')[0] + 'T00:00:00');
    const m = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (m) m.count++;
  }
  const max = Math.max(...months.map((m) => m.count), 1);
  const BAR_HEIGHT = 80;

  return (
    <div className="flex items-end gap-3">
      {months.map((m, i) => {
        const isCurrent = m.month === now.getMonth() && m.year === now.getFullYear();
        const barH = m.count > 0 ? Math.max(8, Math.round((m.count / max) * BAR_HEIGHT)) : 0;
        return (
          <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1.5">
            {m.count > 0 && (
              <span className="text-ninja-muted font-ninja text-xs font-bold">{m.count}</span>
            )}
            <div className="w-full flex flex-col justify-end" style={{ height: BAR_HEIGHT }}>
              <motion.div
                className="w-full rounded-t-md"
                style={{ backgroundColor: isCurrent ? 'rgb(var(--ninja-blue))' : '#93c5fd' }}
                initial={{ height: 0 }}
                animate={{ height: barH > 0 ? `${barH}px` : 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 + 0.2 }}
              />
            </div>
            <span className="text-ninja-muted font-ninja text-xs">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isReadOnly, viewAs } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [roadmapEnrollment, setRoadmapEnrollment] = useState(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get(`/students/${id}`)
      .then((data) => { if (!controller.signal.aborted) setStudent(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Failed to load ninja'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, user?.activeLocation?.id]);

  const handleSaved = (updated) => setStudent((prev) => ({ ...prev, ...updated }));

  const handleLogUpdated = (logId, patch) =>
    setStudent((prev) => ({
      ...prev,
      progress_logs: (prev.progress_logs || []).map((l) => (l.id === logId ? { ...l, ...patch } : l)),
    }));

  const handleLogDeleted = (logId) =>
    setStudent((prev) => ({
      ...prev,
      progress_logs: (prev.progress_logs || []).filter((l) => l.id !== logId),
    }));




  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await api.delete(`/students/${id}`);
      navigate('/manager/students');
    } catch {
      setError('Failed to archive ninja');
      setDeactivating(false);
    } finally {
      setConfirmDeactivate(false);
    }
  };

  const handleHardDelete = async () => {
    setHardDeleting(true);
    try {
      await api.delete(`/students/${id}/permanent`);
      navigate('/manager/students');
    } catch {
      setError('Failed to delete ninja');
      setHardDeleting(false);
    } finally {
      setConfirmHardDelete(false);
    }
  };

  if (loading) return <Layout><SkeletonProfile label="Loading ninja" /></Layout>;
  if (error || !student) return <Layout><p className="text-ninja-red font-ninja text-center py-12">{error || 'Ninja not found'}</p></Layout>;

  const isStudentBirthday = isBirthdayToday(student.birthday);
  const programs = student.programs || [];
  const createEnrollment = programs.find((p) => p.program === 'CREATE');
  const nonCreatePrograms = programs.filter((p) => p.program !== 'CREATE');
  // Code.AI stickers only apply to JR ninjas (JR curriculum runs on Code.AI)
  const canEditSticker = !isReadOnly && programs.some((p) => p.program === 'JR');
  const logs = student.progress_logs || [];
  const clubSessions = student.club_sessions || [];
  // Roadmap bulk-completions are stored as progress_logs for curriculum tracking, but they are
  // NOT real sessions — a session only counts when there's an actual logged session. Drop the
  // roadmap marks before building the activity stats (and the Recent Progress list below).
  const sessionLogs = logs.filter((l) => l.notes !== 'Marked complete from roadmap');
  // Club attendance counts as activity sessions alongside real progress logs (chart + stats only).
  const activitySessions = [...sessionLogs, ...clubSessions];
  const locationName = user?.availableLocations?.find(l => l.id === student.location_id)?.name;

  // Desktop stats
  const now = new Date();
  const sessionsThisMonth = activitySessions.filter((l) => {
    const d = new Date(String(l.session_date).split('T')[0] + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const displayLogs = [...sessionLogs].sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
  const sortedSessions = [...activitySessions].sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
  const lastSessionStr = sortedSessions[0]
    ? new Date(String(sortedSessions[0].session_date).split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <Layout>
      {isStudentBirthday && <BirthdayConfetti />}
      <div>
        <motion.button
          onClick={() => navigate('/manager/students')}
          className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm flex items-center gap-1 transition-colors mb-4"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          ← Back to Roster
        </motion.button>

        {/* ── Mobile layout ───────────────────────────────────────────────── */}
        <motion.div
          className="lg:hidden space-y-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Compact header */}
          <motion.div variants={fadeUp} className="bg-white rounded-2xl p-4 shadow-sm border border-ninja-border">
            <div className="flex items-center gap-3">
              <StudentAvatar
                student={student}
                canEditSticker={canEditSticker}
                onEditSticker={() => setShowStickerPicker(true)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-xl font-bold font-ninja text-ninja-navy leading-tight">{student.full_name}{isStudentBirthday && <span className="ml-2">🎂</span>}</h1>
                  {isManager && !isReadOnly && (
                    <button
                      onClick={() => setShowEdit(true)}
                      className="text-ninja-blue font-ninja text-sm font-semibold flex-shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <p className="text-ninja-muted font-ninja text-sm mt-0.5 truncate">
                  {[
                    locationName,
                    programs.map(p => p.program === 'Robotics Academy' ? 'Robotics' : p.program === 'AI Academy' ? 'AI' : p.program).join(' · '),
                    `Joined ${student.created_at ? new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pinned Note — first so senseis can't miss it. Parent note folded in. */}
          <motion.div variants={fadeUp}>
            <PinnedNote
              studentId={student.id}
              initialNote={student.pinned_note}
              parentNote={student.special_instructions}
              onUpdated={(note) => setStudent((prev) => ({ ...prev, pinned_note: note }))}
            />
          </motion.div>

          {/* Belt Journey (CREATE) */}
          {createEnrollment?.belt_level && (
            <motion.div variants={fadeUp}>
              <MobileBeltJourney enrollment={createEnrollment} />
            </motion.div>
          )}

          {/* Other program cards */}
          {nonCreatePrograms.map((enrollment) => (
            <motion.div key={enrollment.program} variants={fadeUp}>
              <MobileProgramCard enrollment={enrollment} onOpenRoadmap={() => setRoadmapEnrollment(enrollment)} />
            </motion.div>
          ))}

          {/* Activity chart */}
          {activitySessions.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white rounded-2xl p-4 shadow-sm border border-ninja-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-ninja font-bold text-ninja-navy">Activity</h2>
                <span className="text-ninja-blue font-ninja font-bold text-sm">{activitySessions.length} sessions</span>
              </div>
              <MobileActivityChart logs={activitySessions} />
            </motion.div>
          )}

          {/* Recent Progress */}
          {displayLogs.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white rounded-2xl p-4 shadow-sm border border-ninja-border">
              <h2 className="font-ninja font-bold text-ninja-navy mb-3">Recent Progress</h2>
              <div className="max-h-80 overflow-y-auto no-scrollbar">
                <ProgressHistory logs={displayLogs} enrolledPrograms={programs.map((p) => p.program)} onLogUpdated={handleLogUpdated} onLogDeleted={handleLogDeleted} />
              </div>
            </motion.div>
          )}

          {activitySessions.length === 0 && (
            <motion.div variants={fadeUp} className="bg-white rounded-2xl p-8 shadow-sm border border-ninja-border text-center">
              <p className="text-ninja-muted font-ninja text-sm italic">No sessions logged yet.</p>
            </motion.div>
          )}

          {/* Log Progress CTA */}
          {!isReadOnly && programs.length > 0 && (
            <motion.button
              variants={fadeUp}
              onClick={() => navigate(`/sensei/student/${student.id}?programs=${encodeURIComponent(programs.map(p => p.program).join(','))}`)}
              className="w-full bg-ninja-blue text-white font-ninja font-bold py-3.5 rounded-2xl shadow-sm"
            >
              Log Progress
            </motion.button>
          )}
        </motion.div>

        {/* ── Desktop layout (lg+) ── */}
        <div className="hidden lg:block">

          {/* Page header */}
          <motion.div
            className="flex items-start justify-between gap-4 mb-6"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div>
              <h1 className="text-2xl font-bold font-ninja text-ninja-navy leading-tight">{student.full_name}{isStudentBirthday && <span className="ml-2">🎂</span>}</h1>
              <p className="text-ninja-muted font-ninja text-sm mt-1">
                {[
                  programs.map((p) => p.program === 'Robotics Academy' ? 'Robotics' : p.program === 'AI Academy' ? 'AI' : p.program).join(' · '),
                  `Joined ${student.created_at ? new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}`,
                  locationName,
                  student.parent_name && `Parent: ${student.parent_name}`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isManager && !isReadOnly && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="border border-ninja-border text-ninja-navy font-ninja font-semibold text-sm px-4 py-2 rounded-xl hover:bg-ninja-bg transition-colors"
                >
                  Edit
                </button>
              )}
              {programs.length > 0 && !isReadOnly && (
                <button
                  onClick={() => navigate(`/sensei/student/${student.id}?programs=${encodeURIComponent(programs.map((p) => p.program).join(','))}`)}
                  className="bg-ninja-blue text-white font-ninja font-bold text-sm px-4 py-2 rounded-xl hover:bg-ninja-blue/90 transition-colors"
                >
                  + Log Session
                </button>
              )}
            </div>
          </motion.div>

          {/* Two-column layout */}
          <div className="flex gap-6 items-start">

            {/* Left column */}
            <motion.div
              className="flex-1 min-w-0 space-y-5"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {/* Pinned Note — top of page so senseis can't miss it */}
              <motion.div variants={fadeUp}>
                <PinnedNote
                  studentId={student.id}
                  initialNote={student.pinned_note}
                  parentNote={student.special_instructions}
                  onUpdated={(note) => setStudent((prev) => ({ ...prev, pinned_note: note }))}
                />
              </motion.div>

              {/* Belt Journey */}
              {createEnrollment?.belt_level && (
                <motion.div variants={fadeUp}>
                  <DesktopBeltJourney enrollment={createEnrollment} />
                </motion.div>
              )}

              {/* Non-CREATE programs */}
              {nonCreatePrograms.map((enrollment) => (
                <motion.div key={enrollment.program} variants={fadeUp}>
                  <MobileProgramCard enrollment={enrollment} onOpenRoadmap={() => setRoadmapEnrollment(enrollment)} />
                </motion.div>
              ))}

              {/* Activity */}
              <motion.div variants={fadeUp} className="bg-white rounded-2xl p-5 border border-ninja-border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-ninja font-bold text-ninja-navy">Activity</h2>
                  <span className="text-ninja-blue font-ninja font-bold text-sm">
                    {activitySessions.length} sessions · last 6 months
                  </span>
                </div>
                <DesktopActivityChart logs={activitySessions} />
              </motion.div>

              {/* Recent Progress */}
              {displayLogs.length > 0 && (
                <motion.div variants={fadeUp} className="bg-white rounded-2xl p-5 border border-ninja-border shadow-sm">
                  <h2 className="font-ninja font-bold text-ninja-navy mb-3">Recent Progress</h2>
                  <div className="max-h-[32rem] overflow-y-auto no-scrollbar">
                    <ProgressHistory logs={displayLogs} enrolledPrograms={programs.map((p) => p.program)} onLogUpdated={handleLogUpdated} onLogDeleted={handleLogDeleted} />
                  </div>
                </motion.div>
              )}

              {/* Enrollments are managed in the Edit Ninja dialog, beside the
                  ninja's own fields, rather than as a card of red buttons. */}
            </motion.div>

            {/* Right column */}
            <motion.div
              className="w-72 flex-shrink-0 space-y-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            >
              {/* Student info card */}
              <div className="bg-white rounded-2xl p-5 border border-ninja-border shadow-sm">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="mb-3">
                    <StudentAvatar
                      student={student}
                      size="lg"
                      delay={0.22}
                      canEditSticker={canEditSticker}
                      onEditSticker={() => setShowStickerPicker(true)}
                    />
                  </div>
                  <h2 className="font-ninja font-bold text-ninja-navy text-lg leading-tight">{student.full_name}</h2>
                  <p className="text-ninja-muted font-ninja text-sm mt-0.5">
                    {student.birthday
                      ? `Age ${Math.floor((Date.now() - new Date(student.birthday.split('T')[0] + 'T00:00:00')) / (365.25 * 24 * 60 * 60 * 1000))} · `
                      : ''}
                    Member since {student.created_at ? new Date(student.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>

                {/* Stats 2×2 */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Sessions', value: activitySessions.length },
                    { label: 'This month', value: sessionsThisMonth },
                    { label: 'Current belt', value: createEnrollment?.belt_level || '—' },
                    { label: 'Last session', value: lastSessionStr },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      className="bg-ninja-bg rounded-xl p-3"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.06 + 0.3 }}
                    >
                      <p className="text-ninja-muted font-ninja text-xs">{s.label}</p>
                      <p className="font-ninja font-black text-ninja-navy text-lg leading-tight mt-0.5 truncate">{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Parent contact */}
                {isManager && (student.parent_name || student.parent_email || student.parent_phone) && (
                  <div className="mt-4 pt-4 border-t border-ninja-border space-y-1">
                    {student.parent_name && (
                      <p className="text-ninja-muted font-ninja text-sm">
                        <span className="font-semibold text-ninja-navy">Parent:</span> {student.parent_name}
                      </p>
                    )}
                    {student.parent_email && (
                      <p className="text-ninja-muted font-ninja text-sm">
                        <a href={`mailto:${student.parent_email}`} className="text-ninja-blue hover:underline">{student.parent_email}</a>
                      </p>
                    )}
                    {student.parent_phone && (
                      <p className="text-ninja-muted font-ninja text-sm">{student.parent_phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Archive / Delete */}
              {isManager && !isReadOnly && (
                <div className="bg-white rounded-2xl p-4 border border-ninja-border shadow-sm space-y-3">
                  {/* Archive */}
                  {confirmDeactivate ? (
                    <div className="flex gap-2">
                      <Button variant="danger" disabled={deactivating} onClick={handleDeactivate} size="sm">
                        {deactivating ? 'Archiving...' : 'Confirm Archive'}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmDeactivate(false)} size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmDeactivate(true); setConfirmHardDelete(false); }}
                      className="w-full text-ninja-muted font-ninja font-semibold text-sm hover:text-ninja-navy transition-colors text-left"
                    >
                      Archive Ninja
                    </button>
                  )}

                  {/* Delete Permanently */}
                  {!confirmDeactivate && (
                    <>
                      <div className="border-t border-ninja-border" />
                      {confirmHardDelete ? (
                        <div className="space-y-2">
                          <p className="text-ninja-red font-ninja text-xs leading-relaxed">
                            This permanently deletes all progress logs, programs, and session history. Cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <Button variant="danger" disabled={hardDeleting} onClick={handleHardDelete} size="sm">
                              {hardDeleting ? 'Deleting...' : 'Delete Permanently'}
                            </Button>
                            <Button variant="secondary" onClick={() => setConfirmHardDelete(false)} size="sm">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmHardDelete(true)}
                          className="w-full text-ninja-red font-ninja font-semibold text-sm hover:text-red-700 transition-colors text-left"
                        >
                          Delete Permanently
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <EditStudentModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        student={student}
        programs={programs}
        onSaved={handleSaved}
        onProgramsChanged={(saved) => setStudent((prev) => ({ ...prev, programs: saved }))}
      />
      <StickerPickerModal
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        student={student}
        onSaved={(sticker) => setStudent((prev) => ({ ...prev, codeorg_sticker: sticker }))}
      />
      <RoadmapModal
        open={!!roadmapEnrollment}
        onClose={() => setRoadmapEnrollment(null)}
        student={student}
        enrollment={roadmapEnrollment}
        onUpdate={() => {
          setRoadmapEnrollment(null);
          api.get(`/students/${student.id}`).then(data => setStudent(data)).catch(() => {});
        }}
      />
    </Layout>
  );
}
