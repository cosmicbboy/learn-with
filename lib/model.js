// learn-with: course model & validation.
// The atom is the Concept (what the user-model tracks); Modules/Lessons/Exercises
// hang off it. Everything normalizes to plain JSON so it flows to any target.

const DIFFICULTY = [1, 2, 3, 4, 5];
const EXERCISE_KINDS = ['code', 'fill', 'predict', 'output', 'mcq'];
const MASTERY_LADDER = ['unknown', 'learning', 'practiced', 'mastered'];

function id(x) {
  return String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function validateCourse(raw) {
  const errs = [];
  if (!raw.id) errs.push('course.id required');
  if (!raw.title) errs.push('course.title required');
  if (!Array.isArray(raw.modules) || raw.modules.length === 0) errs.push('course.modules (non-empty array) required');
  return errs;
}

// Validate a parsed (non-normalized) course object thoroughly so authors get
// helpful errors instead of silent weirdness at build time.
function validateParsed(course) {
  const errs = [];
  if (!course.id) errs.push('course.id required');
  if (!course.title) errs.push('course.title required');
  (course.modules || []).forEach((m, mi) => {
    if (!m.id) errs.push(`modules[${mi}].id required`);
    if (!Array.isArray(m.lessons) || m.lessons.length === 0) errs.push(`module '${m.id || mi}' has no lessons`);
    (m.lessons || []).forEach((l, li) => {
      if (!l.id) errs.push(`module '${m.id || mi}' lessons[${li}].id required`);
      const items = [...(l.exercises || []), ...(l.quizzes || [])];
      items.forEach((e, ei) => {
        if (!EXERCISE_KINDS.includes(e.kind)) errs.push(`${m.id}/${l.id} item[${ei}]: bad kind '${e.kind}'`);
        if (!e.goal) errs.push(`${m.id}/${l.id} item[${ei}]: missing goal`);
        if (!Array.isArray(e.concepts) || e.concepts.length === 0) errs.push(`${m.id}/${l.id} item[${ei}]: needs >=1 concept`);
        if (e.kind === 'mcq' && !(Array.isArray(e.options) && e.answer != null)) {
          errs.push(`${m.id}/${l.id} item[${ei}]: mcq needs options[] + answer`);
        }
      });
    });
  });
  return errs;
}

module.exports = {
  DIFFICULTY,
  EXERCISE_KINDS,
  MASTERY_LADDER,
  id,
  validateCourse,
  validateParsed,
};
