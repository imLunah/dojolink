import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/layout/Layout';
import { api } from '../api/client';
import { PROGRAM_LOGOS } from '../utils/beltConfig';
import { SkeletonList, SkeletonCards } from '../components/ui/Skeleton';
import CurriculumResources from '../components/shared/CurriculumResources';

const CourseDetail = lazy(() => import('../components/parent/CourseDetail'));

// Program colour is used as a 2px rule under the active tab and nowhere else.
// It marks which program you are in without filling a control with brand colour,
// which is what made every control on this page read as a tinted chip.
const PROGRAM_COLOR = {
  'CREATE': '#60a5fa',
  'JR': '#a78bfa',
  'AI Academy': '#22d3ee',
  'Robotics Academy': '#38a1ff',
  'VR Coding': '#2dd4bf',
};
const DEFAULT_COLOR = '#38a1ff';
const colorFor = (program) => PROGRAM_COLOR[program] || DEFAULT_COLOR;

// Course is the curriculum read the way a parent reads their child's course:
// the same hero, belt road, level card and level ladder, with nobody on it.
const SECTIONS = [
  { key: 'course', label: 'Course' },
  { key: 'resources', label: 'Resources' },
];

// One tab treatment for the whole page: text carries the state, a rule under the
// active one carries the position. No filled backgrounds, no chips.
//
// The rule is the tab's own bottom border rather than a bar positioned against
// the container, so a row that wraps to a second line still underlines the right
// tab instead of leaving the marker floating on the row below.
function Tab({ active, color = 'rgb(var(--ninja-navy))', onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 px-1 pb-2 border-b-2 font-ninja text-sm transition-colors ${
        active
          ? 'font-bold text-ninja-navy'
          : 'font-semibold text-ninja-muted hover:text-ninja-navy border-transparent'
      }`}
      style={active ? { borderBottomColor: color } : undefined}
    >
      {children}
    </button>
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
  const color = colorFor(activeProgram);

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
            {/* Program tabs. Logo identifies the program, the rule marks the one
                you are in. Scrolls sideways on a phone rather than wrapping into
                a block of buttons. */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-ninja-border mt-7">
              {programs.map((p) => (
                <Tab
                  key={p.program}
                  active={p.program === activeProgram}
                  color={colorFor(p.program)}
                  onClick={() => { setActiveProgram(p.program); setSection('course'); }}
                >
                  {PROGRAM_LOGOS[p.program] && (
                    <img
                      src={PROGRAM_LOGOS[p.program]}
                      alt=""
                      className={`w-5 h-5 object-contain transition-opacity ${
                        p.program === activeProgram ? '' : 'opacity-50'
                      }`}
                    />
                  )}
                  {p.program}
                </Tab>
              ))}
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
                  <div className="flex justify-end pt-5 pb-4">
                    <div className="flex gap-5">
                      {SECTIONS.map((s) => (
                        <Tab
                          key={s.key}
                          active={section === s.key}
                          color={color}
                          onClick={() => setSection(s.key)}
                        >
                          {s.label}
                        </Tab>
                      ))}
                    </div>
                  </div>

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
