import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/layout/Layout';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
import Button from '../../components/ui/Button';
import { api } from '../../api/client';
import { BELTS, PROJECTS, STATUSES, PROGRAMS, getLevels } from '../../utils/beltConfig';

const NO_LEVEL_BELTS = ['Black', 'Bronze', 'Silver', 'Platinum'];

function EnrollmentRow({ enrollment, index, onChange, onRemove, showRemove }) {
  const isCreate = enrollment.program === 'CREATE';
  const levels = NO_LEVEL_BELTS.includes(enrollment.belt_level) ? [] : getLevels(enrollment.belt_level);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...enrollment, [name]: value };
    if (name === 'program' && value !== 'CREATE') {
      updated.belt_level = '';
      updated.belt_sublevel = '';
      updated.current_project = '';
      updated.project_status = '';
    }
    if (name === 'belt_level') updated.belt_sublevel = '';
    onChange(index, updated);
  };

  return (
    <div className="border border-ninja-border rounded-xl p-4 space-y-3 bg-ninja-bg">
      <div className="flex items-center justify-between">
        <label className="block text-ninja-muted text-sm font-ninja font-semibold uppercase tracking-wide">
          Program *
        </label>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-ninja-red text-sm font-ninja hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      <select
        name="program"
        value={enrollment.program}
        onChange={handleChange}
        required
        className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
      >
        <option value="">Select a program...</option>
        {PROGRAMS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {isCreate && (
        <div className="space-y-3 pt-2 border-t border-ninja-border/50">
          <p className="text-ninja-muted font-ninja text-xs italic">CREATE details (optional):</p>

          <select
            name="belt_level"
            value={enrollment.belt_level}
            onChange={handleChange}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select belt...</option>
            {BELTS.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>

          {levels.length > 0 && (
            <select
              name="belt_sublevel"
              value={enrollment.belt_sublevel}
              onChange={handleChange}
              className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
            >
              <option value="">Select level...</option>
              {levels.map((lv) => <option key={lv} value={lv}>Level {lv}</option>)}
            </select>
          )}

          <select
            name="current_project"
            value={enrollment.current_project}
            onChange={handleChange}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select project...</option>
            {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            name="project_status"
            value={enrollment.project_status}
            onChange={handleChange}
            className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
          >
            <option value="">Select status...</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

const EMPTY_ENROLLMENT = { program: '', belt_level: '', belt_sublevel: '', current_project: '', project_status: '' };

// Stable row ids so React keys survive add/remove (index keys bleed row DOM state).
let _enrollSeq = 0;
const newEnrollment = () => ({ ...EMPTY_ENROLLMENT, _uid: `enroll-${++_enrollSeq}` });

export default function AddStudentPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [showBirthday, setShowBirthday] = useState(false);
  const [enrollments, setEnrollments] = useState([newEnrollment()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnrollmentChange = (index, updated) => {
    setEnrollments((prev) => prev.map((e, i) => (i === index ? updated : e)));
  };

  const addEnrollment = () => {
    setEnrollments((prev) => [...prev, newEnrollment()]);
  };

  const removeEnrollment = (index) => {
    setEnrollments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = enrollments.filter((e) => e.program);
    if (valid.length === 0) {
      setError('At least one program is required');
      return;
    }
    const programs = valid.map((e) => e.program);
    if (new Set(programs).size !== programs.length) {
      setError('A ninja cannot be enrolled in the same program twice');
      return;
    }

    setLoading(true);
    setError('');

    let createdStudentId = null;
    try {
      const student = await api.post('/students', {
        full_name: name,
        birthday: birthday || null,
      });
      createdStudentId = student.id;

      await Promise.all(valid.map((enrollment) => {
        const isCreate = enrollment.program === 'CREATE';
        return api.post(`/students/${student.id}/programs`, {
          program: enrollment.program,
          belt_level: isCreate && enrollment.belt_level ? enrollment.belt_level : null,
          belt_sublevel: isCreate && enrollment.belt_sublevel ? parseInt(enrollment.belt_sublevel) : null,
          current_project: isCreate && enrollment.current_project ? enrollment.current_project : null,
          project_status: isCreate && enrollment.project_status ? enrollment.project_status : null,
        });
      }));

      navigate(`/manager/students/${student.id}`);
    } catch (err) {
      if (createdStudentId) {
        // Student was created but program enrollment failed — navigate to profile so the user can fix it there
        navigate(`/manager/students/${createdStudentId}`);
      } else {
        setError(err.message || 'Failed to create ninja');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <motion.div className="max-w-xl mx-auto" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="mb-6">
          <button
            onClick={() => navigate('/manager/students')}
            className="text-ninja-muted hover:text-ninja-blue font-ninja text-sm mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back to Roster
          </button>
          <h1 className="text-2xl sm:text-4xl font-bold font-ninja text-ninja-navy">
            New <span className="text-ninja-blue">Ninja</span>
          </h1>
        </motion.div>

        <motion.div variants={fadeUp} className="bg-white border border-ninja-border rounded-xl p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-ninja-border text-ninja-red rounded-lg p-3 mb-4 text-sm font-ninja">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ninja's full name"
                className="w-full bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-ninja-muted text-sm font-ninja font-semibold mb-1 uppercase tracking-wide">
                Birthday
              </label>
              {showBirthday ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="flex-1 bg-white border border-ninja-border text-ninja-navy rounded-lg px-4 py-2 font-ninja focus:outline-none focus:border-ninja-blue transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowBirthday(false); setBirthday(''); }}
                    className="text-ninja-muted hover:text-ninja-red font-ninja text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBirthday(true)}
                  className="text-ninja-blue font-ninja text-sm hover:underline"
                >
                  + Add birthday
                </button>
              )}
            </div>

            <div className="border-t border-ninja-border pt-4">
              <p className="text-ninja-muted font-ninja text-sm font-semibold uppercase tracking-wide mb-3">
                Programs
              </p>
              <div className="space-y-3">
                {enrollments.map((enrollment, index) => (
                  <EnrollmentRow
                    key={enrollment._uid}
                    enrollment={enrollment}
                    index={index}
                    onChange={handleEnrollmentChange}
                    onRemove={removeEnrollment}
                    showRemove={enrollments.length > 1}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={addEnrollment}
                className="mt-3 text-ninja-blue font-ninja text-sm hover:underline"
              >
                + Add another program
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Ninja'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => navigate('/manager/students')}>
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
