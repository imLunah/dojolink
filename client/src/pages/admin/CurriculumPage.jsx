import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../../components/layout/Layout';
import { api } from '../../api/client';
import { useCurriculum, invalidateCurriculumCache } from '../../context/CurriculumContext';
import { BELT_LEVEL_PROJECTS as STATIC_BELT_PROJECTS, BELTS } from '../../utils/beltConfig';
import { SkeletonList } from '../../components/ui/Skeleton';
import { WarningIcon } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';

const PROGRAMS = ['AI Academy', 'Robotics Academy', 'JR', 'VR Coding', 'CREATE'];

const BELT_COLORS = {
  White:  { bg: '#f8f8f8', border: '#d1d5db', text: '#111827' },
  Yellow: { bg: '#fef9c3', border: '#fbbf24', text: '#78350f' },
  Orange: { bg: '#fff7ed', border: '#f97316', text: '#7c2d12' },
  Green:  { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' },
  Blue:   { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },
  Purple: { bg: '#faf5ff', border: '#a855f7', text: '#581c87' },
  Brown:  { bg: '#fdf8f0', border: '#92400e', text: '#451a03' },
  Red:    { bg: '#fef2f2', border: '#cc0000', text: '#7f1d1d' },
  Black:  { bg: '#f3f4f6', border: '#111111', text: '#111827' },
  Bronze: { bg: '#fdf3e7', border: '#cd7f32', text: '#7c2d12' },
  Silver: { bg: '#f4f6f8', border: '#c0c0c0', text: '#334155' },
  Gold:   { bg: '#fdf6e3', border: '#d4af37', text: '#7c5e10' },
  Platinum: { bg: '#f7fafc', border: '#cbd5e1', text: '#334155' },
};

const ADMIN_NAV_LINKS = [
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/users', label: 'Users' },
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

function LessonRow({ lesson, onRename, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lesson.lesson_name);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim() || name.trim() === lesson.lesson_name) { setEditing(false); return; }
    setSaving(true);
    try { await onRename(lesson.id, name.trim()); setEditing(false); }
    catch { setName(lesson.lesson_name); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 py-1 pl-4 group">
      <span className="text-ninja-muted text-xs">·</span>
      {!readOnly && editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(lesson.lesson_name); setEditing(false); } }}
          className="flex-1 bg-white border border-ninja-blue rounded px-2 py-0.5 font-ninja text-sm text-ninja-navy focus:outline-none"
          disabled={saving}
        />
      ) : (
        <span
          className={`flex-1 font-ninja text-sm text-ninja-navy ${!readOnly ? 'cursor-pointer hover:text-ninja-blue transition-colors' : ''}`}
          onClick={() => !readOnly && setEditing(true)}
        >
          {lesson.lesson_name}
        </span>
      )}
      {!readOnly && !editing && (
        confirmDelete ? (
          <span className="flex items-center gap-1">
            <button onClick={() => onDelete(lesson.id)} className="text-[10px] font-ninja font-semibold text-white bg-ninja-red rounded px-2 py-0.5 hover:opacity-90">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[10px] font-ninja text-ninja-muted hover:text-ninja-navy">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 text-[10px] font-ninja text-ninja-muted hover:text-ninja-red transition-all">✕</button>
        )
      )}
    </div>
  );
}

function ModuleBlock({ mod, onRenameModule, onUpdateDescription, onDeleteModule, onAddLesson, onRenameLesson, onDeleteLesson, readOnly }) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [moduleName, setModuleName] = useState(mod.module);
  const [description, setDescription] = useState(mod.description || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLesson, setNewLesson] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveModuleName = async () => {
    if (!moduleName.trim() || moduleName.trim() === mod.module) { setEditingName(false); return; }
    setSaving(true);
    try { await onRenameModule(mod.id, moduleName.trim()); setEditingName(false); }
    catch { setModuleName(mod.module); }
    finally { setSaving(false); }
  };

  const saveDescription = async () => {
    setEditingDesc(false);
    if (description === (mod.description || '')) return;
    try { await onUpdateDescription(mod.id, description); }
    catch { setDescription(mod.description || ''); }
  };

  const submitLesson = async (e) => {
    e.preventDefault();
    if (!newLesson.trim()) return;
    setAddingLesson(true);
    try { await onAddLesson(mod.id, newLesson.trim()); setNewLesson(''); }
    finally { setAddingLesson(false); }
  };

  const lessons = mod._lessons
    ? mod._lessons
    : (mod.lessons || []).map((l, i) => ({ id: null, lesson_name: l, lesson_order: i }));

  return (
    <div className="border border-ninja-border rounded-xl overflow-hidden mb-2">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-ninja-bg cursor-pointer select-none group"
        onClick={() => !editingName && setExpanded(e => !e)}
      >
        <span className="text-ninja-muted text-xs">{expanded ? '▾' : '▸'}</span>
        {editingName ? (
          <input
            autoFocus
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            onBlur={saveModuleName}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveModuleName(); } if (e.key === 'Escape') { setModuleName(mod.module); setEditingName(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white border border-ninja-blue rounded px-2 py-0.5 font-ninja text-sm font-semibold text-ninja-navy focus:outline-none"
            disabled={saving}
          />
        ) : (
          <span className="flex-1 font-ninja text-sm font-semibold text-ninja-navy">{mod.module}</span>
        )}
        <span className="text-ninja-muted font-ninja text-xs">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
        {!readOnly && !editingName && !confirmDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] font-ninja text-ninja-muted hover:text-ninja-blue transition-all px-1"
          >
            Edit
          </button>
        )}
        {!readOnly && !editingName && (
          confirmDelete ? (
            <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => onDeleteModule(mod.id)} className="text-[10px] font-ninja font-semibold text-white bg-ninja-red rounded px-2 py-0.5">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] font-ninja text-ninja-muted">Cancel</button>
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="opacity-0 group-hover:opacity-100 text-[10px] font-ninja text-ninja-muted hover:text-ninja-red transition-all"
            >
              ✕
            </button>
          )
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white px-3 py-2">
              {/* Description */}
              <div className="mb-2 pb-2 border-b border-ninja-border/60">
                {!readOnly && editingDesc ? (
                  <textarea
                    autoFocus
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={saveDescription}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setDescription(mod.description || ''); setEditingDesc(false); } }}
                    rows={3}
                    placeholder="Module description…"
                    className="w-full bg-ninja-bg border border-ninja-blue rounded-lg px-3 py-2 font-ninja text-xs text-ninja-navy focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    className={`font-ninja text-xs text-ninja-muted leading-relaxed ${!readOnly ? 'cursor-pointer hover:text-ninja-navy transition-colors' : ''}`}
                    onClick={() => !readOnly && setEditingDesc(true)}
                  >
                    {description || (!readOnly ? <span className="italic opacity-50">Add description…</span> : null)}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
              {lessons.map((l, i) => (
                <LessonRow
                  key={l.id ?? `static-${i}`}
                  lesson={l}
                  onRename={onRenameLesson}
                  onDelete={onDeleteLesson}
                  readOnly={readOnly}
                />
              ))}
              {!readOnly && (
                <form onSubmit={submitLesson} className="flex gap-2 mt-2 pl-4">
                  <input
                    value={newLesson}
                    onChange={(e) => setNewLesson(e.target.value)}
                    placeholder="Add lesson…"
                    className="flex-1 bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-xs focus:outline-none focus:border-ninja-blue"
                    disabled={addingLesson}
                  />
                  <button
                    type="submit"
                    disabled={!newLesson.trim() || addingLesson}
                    className="bg-ninja-blue text-white font-ninja font-semibold rounded-lg px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Add
                  </button>
                </form>
              )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Project row (belt editor equivalent of LessonRow) ────────────────────────
function ProjectRow({ project, onRename, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.project_name);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim() || name.trim() === project.project_name) { setEditing(false); return; }
    setSaving(true);
    try { await onRename(project.id, name.trim()); setEditing(false); }
    catch { setName(project.project_name); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 py-1 pl-4 group">
      <span className="text-ninja-muted text-xs">·</span>
      {!readOnly && editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(project.project_name); setEditing(false); } }}
          className="flex-1 bg-white border border-ninja-blue rounded px-2 py-0.5 font-ninja text-sm text-ninja-navy focus:outline-none"
          disabled={saving}
        />
      ) : (
        <span
          className={`flex-1 font-ninja text-sm text-ninja-navy ${!readOnly ? 'cursor-pointer hover:text-ninja-blue transition-colors' : ''}`}
          onClick={() => !readOnly && setEditing(true)}
        >
          {project.project_name}
        </span>
      )}
      {!readOnly && !editing && (
        confirmDelete ? (
          <span className="flex items-center gap-1">
            <button onClick={() => onDelete(project.id)} className="text-[10px] font-ninja font-semibold text-white bg-ninja-red rounded px-2 py-0.5 hover:opacity-90">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-[10px] font-ninja text-ninja-muted hover:text-ninja-navy">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 text-[10px] font-ninja text-ninja-muted hover:text-ninja-red transition-all">✕</button>
        )
      )}
    </div>
  );
}

// ── Sublevel block (belt editor equivalent of ModuleBlock) ───────────────────
function SublevelBlock({ beltName, sublevel, projects, onAddProject, onRenameProject, onDeleteProject, readOnly }) {
  const [expanded, setExpanded] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!newProject.trim()) return;
    setAdding(true);
    try { await onAddProject(beltName, sublevel, newProject.trim()); setNewProject(''); }
    finally { setAdding(false); }
  };

  return (
    <div className="border border-ninja-border rounded-xl overflow-hidden mb-2">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-ninja-bg cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-ninja-muted text-xs">{expanded ? '▾' : '▸'}</span>
        <span className="flex-1 font-ninja text-sm font-semibold text-ninja-navy">Level {sublevel}</span>
        <span className="text-ninja-muted font-ninja text-xs">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white px-3 py-2 space-y-0.5">
              {projects.map((p, i) => (
                <ProjectRow
                  key={p.id ?? `static-${i}`}
                  project={p}
                  onRename={onRenameProject}
                  onDelete={onDeleteProject}
                  readOnly={readOnly}
                />
              ))}
              {!readOnly && (
                <form onSubmit={submit} className="flex gap-2 mt-2 pl-4">
                  <input
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    placeholder="Add project…"
                    className="flex-1 bg-ninja-bg border border-ninja-border text-ninja-navy rounded-lg px-3 py-1.5 font-ninja text-xs focus:outline-none focus:border-ninja-blue"
                    disabled={adding}
                  />
                  <button
                    type="submit"
                    disabled={!newProject.trim() || adding}
                    className="bg-ninja-blue text-white font-ninja font-semibold rounded-lg px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CREATE belt editor ────────────────────────────────────────────────────────
function BeltEditor() {
  const { refresh: refreshCurriculum } = useCurriculum();
  const BELT_NAMES = BELTS.map(b => b.name);
  const [selectedBelt, setSelectedBelt] = useState('White');
  const [beltData, setBeltData] = useState(null); // null = not yet fetched
  const [isSeeded, setIsSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');

  useEffect(() => {
    fetch('/api/curriculum/belt-projects', { credentials: 'include' })
      .then(r => r.status === 204 ? null : r.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          // Convert string sublevel keys to numbers for consistency
          const normalized = {};
          for (const [belt, sublevels] of Object.entries(data)) {
            normalized[belt] = {};
            for (const [lvl, projects] of Object.entries(sublevels)) {
              normalized[belt][parseInt(lvl)] = projects;
            }
          }
          setBeltData(normalized);
          setIsSeeded(true);
        } else {
          // Fall back to static
          const staticNorm = {};
          for (const [belt, sublevels] of Object.entries(STATIC_BELT_PROJECTS)) {
            staticNorm[belt] = {};
            for (const [lvl, names] of Object.entries(sublevels)) {
              staticNorm[belt][parseInt(lvl)] = names.map((n, i) => ({ id: null, project_name: n, project_order: i }));
            }
          }
          setBeltData(staticNorm);
          setIsSeeded(false);
        }
      })
      .catch(() => {
        const staticNorm = {};
        for (const [belt, sublevels] of Object.entries(STATIC_BELT_PROJECTS)) {
          staticNorm[belt] = {};
          for (const [lvl, names] of Object.entries(sublevels)) {
            staticNorm[belt][parseInt(lvl)] = names.map((n, i) => ({ id: null, project_name: n, project_order: i }));
          }
        }
        setBeltData(staticNorm);
        setIsSeeded(false);
      });
  }, []);

  const refetch = async () => {
    const r = await fetch('/api/curriculum/belt-projects', { credentials: 'include' });
    if (r.status === 204) return;
    const data = await r.json();
    const normalized = {};
    for (const [belt, sublevels] of Object.entries(data)) {
      normalized[belt] = {};
      for (const [lvl, projects] of Object.entries(sublevels)) {
        normalized[belt][parseInt(lvl)] = projects;
      }
    }
    setBeltData(normalized);
    refreshCurriculum().catch(() => {}); // keep context beltProjects in sync
  };

  const handleSeed = async () => {
    setSeedError('');
    setSeeding(true);
    try {
      await api.post('/curriculum/belt-projects/seed', {});
      setIsSeeded(true);
      await refetch();
    } catch (err) {
      setSeedError(err?.message || 'Failed to initialize belt projects.');
    } finally {
      setSeeding(false);
    }
  };

  const handleAddProject = async (beltName, sublevel, projectName) => {
    await api.post('/curriculum/belt-projects', { belt_name: beltName, sublevel, project_name: projectName });
    await refetch().catch(() => {});
  };

  const handleRenameProject = async (id, name) => {
    await api.patch(`/curriculum/belt-projects/${id}`, { project_name: name });
    await refetch().catch(() => {});
  };

  const handleDeleteProject = async (id) => {
    await api.delete(`/curriculum/belt-projects/${id}`);
    await refetch().catch(() => {});
  };

  const colors = BELT_COLORS[selectedBelt] || { bg: '#f8f8f8', border: '#d1d5db', text: '#111827' };
  const sublevels = beltData?.[selectedBelt] ? Object.keys(beltData[selectedBelt]).map(Number).sort((a, b) => a - b) : [];

  if (!beltData) {
    return <SkeletonList rows={6} label="Loading curriculum" />;
  }

  return (
    <div>
      {!isSeeded && (
        <div className="bg-blue-50 border border-ninja-border rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-ninja-navy font-ninja font-semibold text-sm">Viewing built-in defaults</p>
            <p className="text-ninja-muted font-ninja text-xs mt-0.5">Initialize to enable editing. Belt projects will be saved to the database.</p>
            {seedError && <p className="text-ninja-red font-ninja text-xs mt-1">{seedError}</p>}
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex-shrink-0 bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {seeding ? 'Initializing…' : 'Initialize'}
          </button>
        </div>
      )}

      {/* Belt tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {BELT_NAMES.map(belt => {
          const c = BELT_COLORS[belt] || { bg: '#f8f8f8', border: '#d1d5db', text: '#111827' };
          const active = selectedBelt === belt;
          return (
            <button
              key={belt}
              onClick={() => setSelectedBelt(belt)}
              className="px-3 py-1.5 rounded-xl font-ninja text-sm font-semibold transition-colors"
              style={{
                background: active ? c.bg : 'transparent',
                color: active ? c.text : 'var(--ninja-muted, #6b7280)',
                border: '1px solid var(--ninja-border, #e5e7eb)',
                fontWeight: active ? 700 : 500,
              }}
            >
              {belt}
            </button>
          );
        })}
      </div>

      {/* Sublevel blocks */}
      <div>
        {sublevels.length === 0 && (
          <p className="text-ninja-muted font-ninja text-sm py-4 text-center">No levels defined for {selectedBelt} belt.</p>
        )}
        {sublevels.map(lvl => (
          <SublevelBlock
            key={lvl}
            beltName={selectedBelt}
            sublevel={lvl}
            projects={beltData[selectedBelt][lvl] || []}
            onAddProject={handleAddProject}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            readOnly={!isSeeded}
          />
        ))}
      </div>
    </div>
  );
}

export default function CurriculumPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { subPrograms, curriculum, refresh: refreshCurriculum } = useCurriculum();

  const [selectedProgram, setSelectedProgram] = useState('AI Academy');
  const [selectedSubProgram, setSelectedSubProgram] = useState(null);
  const [localCurriculum, setLocalCurriculum] = useState(null);
  const [isSeeded, setIsSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalCurriculum(curriculum);
    const firstKey = Object.keys(curriculum)[0];
    const firstMod = firstKey && curriculum[firstKey]?.[0];
    setIsSeeded(!!(firstMod?.id));
  }, [curriculum]);

  const subs = subPrograms[selectedProgram];
  const activeKey = selectedSubProgram || (subs ? subs[0] : selectedProgram);
  const modules = localCurriculum?.[activeKey] || [];

  const handleSeed = async () => {
    setSeedError('');
    setSeeding(true);
    try {
      await api.post('/curriculum/seed', {});
      invalidateCurriculumCache();
      window.location.reload();
    } catch (err) {
      setSeedError(err?.message || 'Failed to initialize curriculum.');
    } finally {
      setSeeding(false);
    }
  };

  const refetch = async () => {
    await refreshCurriculum();
    setLocalCurriculum(null); // fall back to freshly updated context
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;
    setAddingModule(true);
    setError('');
    try {
      await api.post('/curriculum/modules', {
        program: selectedProgram,
        sub_program: subs ? activeKey : null,
        module_name: newModuleName.trim(),
      });
      setNewModuleName('');
      await refetch();
    } catch (err) {
      setError(err?.message || 'Failed to add module.');
    } finally {
      setAddingModule(false);
    }
  };

  const handleRenameModule = async (id, name) => {
    await api.patch(`/curriculum/modules/${id}`, { module_name: name });
    await refetch().catch(() => {});
  };

  const handleUpdateDescription = async (id, description) => {
    await api.patch(`/curriculum/modules/${id}`, { description });
    await refetch().catch(() => {});
  };

  const handleDeleteModule = async (id) => {
    await api.delete(`/curriculum/modules/${id}`);
    await refetch().catch(() => {});
  };

  const handleAddLesson = async (moduleId, name) => {
    await api.post(`/curriculum/modules/${moduleId}/lessons`, { lesson_name: name });
    await refetch().catch(() => {});
  };

  const handleRenameLesson = async (id, name) => {
    await api.patch(`/curriculum/lessons/${id}`, { lesson_name: name });
    await refetch().catch(() => {});
  };

  const handleDeleteLesson = async (id) => {
    await api.delete(`/curriculum/lessons/${id}`);
    await refetch().catch(() => {});
  };

  const readOnly = !isSeeded;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <AdminNav />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-ninja-navy font-ninja font-bold text-2xl">Curriculum</h1>
            <p className="text-ninja-muted font-ninja text-sm mt-0.5">Edit modules and lessons for each program</p>
          </div>
        </div>

        {/* One curriculum, three centers. A director can fix a typo in a lesson
            name without waiting for an admin, which is the point of them being
            here — but the edit lands everywhere, and nothing else on the page
            would tell them that. */}
        {!isAdmin && (
          <div className="flex items-start gap-2.5 rounded-xl border border-ninja-border bg-amber-500/5 p-3 mb-6">
            <span aria-hidden className="mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0">
              <WarningIcon width="16" height="16" />
            </span>
            <p className="font-ninja text-xs text-ninja-navy">
              The curriculum is shared by every center. Edits here change what
              Yorba Linda, Fullerton and Cerritos all teach, not only your center.
            </p>
          </div>
        )}

        {/* Program tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          {PROGRAMS.map(p => (
            <button
              key={p}
              onClick={() => { setSelectedProgram(p); setSelectedSubProgram(null); }}
              className="px-3 py-1.5 rounded-xl font-ninja text-sm font-semibold transition-colors"
              style={{
                background: selectedProgram === p ? 'rgb(0,106,221)' : 'transparent',
                color: selectedProgram === p ? '#fff' : 'var(--ninja-muted, #6b7280)',
                border: selectedProgram === p ? 'none' : '1px solid var(--ninja-border, #e5e7eb)',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* CREATE tab — belt/project editor */}
        {selectedProgram === 'CREATE' ? (
          <BeltEditor />
        ) : (
          <>
            {readOnly && (
              <div className="bg-blue-50 border border-ninja-border rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-ninja-navy font-ninja font-semibold text-sm">Viewing built-in defaults</p>
                  <p className="text-ninja-muted font-ninja text-xs mt-0.5">Initialize to enable editing. Modules and lessons will be saved to the database.</p>
                  {seedError && <p className="text-ninja-red font-ninja text-xs mt-1">{seedError}</p>}
                </div>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="flex-shrink-0 bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {seeding ? 'Initializing…' : 'Initialize'}
                </button>
              </div>
            )}

            {/* Sub-program tabs */}
            {subs && (
              <div className="flex gap-2 flex-wrap mb-4">
                {subs.map(sp => (
                  <button
                    key={sp}
                    onClick={() => setSelectedSubProgram(sp)}
                    className="px-3 py-1 rounded-lg font-ninja text-xs font-semibold transition-colors"
                    style={{
                      background: activeKey === sp ? 'rgba(0,106,221,0.1)' : 'transparent',
                      color: activeKey === sp ? 'rgb(0,106,221)' : 'var(--ninja-muted, #6b7280)',
                      border: '1px solid',
                      borderColor: activeKey === sp ? 'rgb(0,106,221)' : 'var(--ninja-border, #e5e7eb)',
                    }}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            )}

            {/* Modules */}
            <div>
              {modules.map(mod => (
                <ModuleBlock
                  key={mod.id || mod.module}
                  mod={mod}
                  readOnly={readOnly}
                  onRenameModule={handleRenameModule}
                  onUpdateDescription={handleUpdateDescription}
                  onDeleteModule={handleDeleteModule}
                  onAddLesson={handleAddLesson}
                  onRenameLesson={handleRenameLesson}
                  onDeleteLesson={handleDeleteLesson}
                />
              ))}

              {error && <p className="text-ninja-red font-ninja text-xs mb-2">{error}</p>}

              {!readOnly && (
                <form onSubmit={handleAddModule} className="flex gap-2 mt-3">
                  <input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="New module name…"
                    className="flex-1 bg-white border border-ninja-border text-ninja-navy rounded-xl px-3 py-2 font-ninja text-sm focus:outline-none focus:border-ninja-blue"
                    disabled={addingModule}
                  />
                  <button
                    type="submit"
                    disabled={!newModuleName.trim() || addingModule}
                    className="bg-ninja-blue text-white font-ninja font-semibold rounded-xl px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {addingModule ? '…' : '+ Module'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
