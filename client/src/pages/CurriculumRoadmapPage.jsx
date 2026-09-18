import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/layout/Layout';
import { api } from '../api/client';
import { PROGRAM_LOGOS } from '../utils/beltConfig';
import { SkeletonList, SkeletonCards } from '../components/ui/Skeleton';
import CurriculumResources from '../components/shared/CurriculumResources';

const CourseDetail = lazy(() => import('../components/parent/CourseDetail'));

// Course is the curriculum read the way a parent reads their child's course:
// the same hero, belt road, level card and level ladder, with nobody on it.
const SECTIONS = [
  { key: 'course', label: 'Course' },
  { key: 'resources', label: 'Resources' },
];

const SLIDE = { type: 'spring', stiffness: 480, damping: 38 };

// A segmented control: a sunken track and one raised pill that slides to the
// choice, so the eye follows it instead of hunting for an underline. The pill
// is `bg-white`, which the dark theme maps to its raised surface, so it lifts
// off the track in both themes. `layoutId` must be unique per control.
function Segmented({ items, value, onChange, layoutId, label, className = '' }) {
  return (
    <div role="tablist" aria-label={label}
      className={`inline-flex items-center gap-1 p-1 rounded-[16px] bg-ninja-navy/[0.05] border border-ninja-border ${className}`}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`relative flex-shrink-0 inline-flex items-center gap-2 h-10 rounded-[12px] font-ninja text-sm whitespace-nowrap transition-colors duration-150 active:scale-[0.97] ${it.logo ? 'pl-2 pr-3.5' : 'px-3.5'} ${active ? 'font-extrabold text-ninja-navy' : 'font-bold text-ninja-muted hover:text-ninja-navy'}`}
          >
            {active && (
              <motion.span layoutId={layoutId} transition={SLIDE} aria-hidden
                className="absolute inset-0 rounded-[12px] bg-white shadow-[0_1px_2px_rgb(6_13_26_/_0.08),0_4px_12px_-4px_rgb(6_13_26_/_0.18)] ring-1 ring-ninja-border" />
            )}
            {it.logo && (
              <img src={it.logo} alt="" draggable={false}
                className={`relative w-7 h-7 object-contain transition-[opacity,filter] duration-150 ${active ? '' : 'opacity-60 saturate-50'}`} />
            )}
            <span className="relative">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CurriculumRoadmapPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [section, setSection] = useState('course');

  useEffect(() => {
    api.get('/curriculum/roadmap')
      .then((data) => {
        setPrograms(data);
        if (data.length > 0) setActiveProgram(data[0].program);
      })
      .catch(() => setError('Failed to load curriculum'))
      .finally(() => setLoading(false));
  }, []);

  const current = programs.find((p) => p.program === activeProgram);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="font-ninja font-extrabold text-2xl text-ninja-navy">Curriculum</h1>
        <p className="font-ninja text-sm text-ninja-muted mt-1">
          Every program, module and lesson, plus the reference material for each.
        </p>

        {loading && <div className="mt-8"><SkeletonList rows={6} label="Loading curriculum" /></div>}
        {error && <p className="font-ninja text-sm text-ninja-red py-12 text-center">{error}</p>}

        {!loading && !error && programs.length > 0 && (
          <>
            {/* Programs on the left, what to read about the chosen one on
                the right. The program row scrolls sideways on a phone rather
                than wrapping into a block of buttons. */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 mb-5">
              <div className="-mx-4 px-4 sm:mx-0 sm:px-0 max-w-full overflow-x-auto no-scrollbar">
                <Segmented
                  label="Programs"
                  layoutId="curriculum-program"
                  value={activeProgram}
                  onChange={(key) => { setActiveProgram(key); setSection('course'); }}
                  items={programs.map((p) => ({ key: p.program, label: p.program, logo: PROGRAM_LOGOS[p.program] }))}
                />
              </div>
              <Segmented label="Section" layoutId="curriculum-section" value={section} onChange={setSection} items={SECTIONS} />
            </div>

            <AnimatePresence mode="wait">
              {current && (
                <motion.div
                  key={current.program}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {section === 'course' ? (
                    <Suspense fallback={<SkeletonCards count={1} height={260} label={`Loading ${current.program}`} />}>
                      <CourseDetail key={current.program} enrollment={{ program: current.program }} mode="reference" />
                    </Suspense>
                  ) : (
                    <CurriculumResources program={current.program} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </Layout>
  );
}
