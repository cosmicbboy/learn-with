// learn-with: compile a course directory (course.hl.yml + content/*) into a
// standalone course.json manifest.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { parseLesson } = require('./content');
const { validateCourse, validateParsed, DIFFICULTY, MASTERY_LADDER } = require('./model');
const levels = require('./adaptive/levels');

const DEFAULT_SKILLS = {
  ownership: 'Understand Rust ownership, moves, and the borrow checker.',
  borrowing: 'Use shared (&T) and mutable (&mut T) references within lifetimes.',
  structs: 'Define structs and work with fields and methods (impl).',
  derives: 'Derive common traits (Debug, Clone, Serialize, Default).',
  enums: 'Model alternatives with enums and handle them with match.',
  pattern_matching: 'Destructure data and branch with match / if let.',
  result_option: 'Handle fallibility with Result and Option.',
  error_handling: 'Propagate errors with ? and define custom error types.',
  string_vs_str: 'Know the String/&str relationship and when to use each.',
  slices: 'Work with array/vector/view slices &[T].',
  iterators: 'Compose data with map, filter, collect, and closures.',
  collections: 'Use Vec, HashMap, BTreeMap and their trade-offs.',
  expression: 'Treat everything as an expression; return values, not statements.',
  modules: 'Organize code with modules and crates.',
  traits: 'Define shared behaviour with traits, bounds and generics.',
  from_display: 'Implement From and Display to convert and format.',
  concurrency: 'Share work across threads with Arc, Mutex, channels, async.',
  testing: 'Write unit, integration and doc tests with cargo test.',
  macros: 'Read and write declarative/derive-style macros.',
  serde: 'Serialize and deserialize data with the serde ecosystem.',
  lifetimes: 'Declare and infer reference lifetimes.',
  cli: 'Parse args and build command-line tools.',
};

// ----- reading -----------------------------------------------------------------------

function readCourseDir(dir) {
  const yml = path.join(dir, 'course.hl.yml');
  if (!fs.existsSync(yml)) throw new Error(`No ${path.basename(yml)} in ${dir}`);
  const raw = yaml.load(fs.readFileSync(yml, 'utf8'));
  validateCourse(raw); // throws? no, returns errs — we throw
  const errs = validateCourse(raw);
  if (errs.length) throw new Error('course.hl.yml invalid:\n - ' + errs.join('\n - '));

  const modules = [];
  for (const mRaw of raw.modules) {
    const lessons = [];
    for (const lRaw of mRaw.lessons || []) {
      const file = path.resolve(dir, lRaw.file || `content/${mRaw.id}/${lRaw.id}.md`);
      if (!fs.existsSync(file)) throw new Error(`Lesson file not found: ${file}`);
      const text = fs.readFileSync(file, 'utf8');
      const lesson = parseLesson(text, lRaw);
      lesson.id = lesson.id || (lRaw.id ? String(lRaw.id).toLowerCase() : `lesson-${lessons.length}`);
      lessons.push(lesson);
    }
    modules.push({ ...mRaw, lessons });
  }

  const course = { ...raw, modules };
  const verrors = validateParsed(course);
  // depth variants: one item per (id, level) within a lesson
  for (const m of modules) for (const l of m.lessons) {
    const seen = new Set();
    for (const e of [...l.exercises, ...l.quizzes]) {
      const k = `${e.id}@${e.level || 0}`;
      if (seen.has(k)) verrors.push(`${m.id}/${l.id}: two items with id "${e.id}" at depth ${e.level || 0} — give variants different level= values`);
      seen.add(k);
    }
  }
  if (verrors.length) throw new Error('Course invalid:\n - ' + verrors.join('\n - '));
  return course;
}

// ----- normalization ---------------------------------------------------------------

// flatten to a concept index with definitions + which items exercise them
function buildConceptIndex(course) {
  const index = {};
  const add = (concept) => {
    if (!concept) return;
    index[concept] = index[concept] || {
      concept,
      summary: DEFAULT_SKILLS[concept] || 'Core Rust concept studied through hlock.',
      firstSeenByModule: null,
      items: [],
    };
  };
  for (const m of course.modules) {
    for (const l of m.lessons) {
      for (const c of l.concepts || []) { add(c); index[c].firstSeenByModule = index[c].firstSeenByModule || m.id; }
      const items = [...l.exercises, ...l.quizzes];
      for (const it of items) for (const c of it.concepts || []) { add(c); index[c].items.push(it); }
    }
  }
  return index;
}

// Normalize into a self-contained, serializable course.json.
function normalize(course) {
  const concepts = buildConceptIndex(course);
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle || '',
    author: course.author || '',
    blurb: course.blurb || '',
    persona: course.persona || { python: 3, javascript: 3, r: 1 },
    defaultDifficulty: course.defaultDifficulty || 2,
    ladder: MASTERY_LADDER,
    difficultyRange: DIFFICULTY,
    concepts: Object.values(concepts).map((c) => ({ ...c, items: undefined })), // drop item refs; keep map
    conceptMap: concepts,
    project: course.project || { repo: '', note: '' },
    levels: levels.normalizeLevels(course.levels, course.modules.flatMap((m) => m.lessons.map((l) => ({ m: m.id, l: l.id })))),
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      blurb: m.blurb || '',
      objectives: m.objectives || [],
      capstone: m.capstone || false,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        concepts: l.concepts || [],
        objectives: l.objectives || [],
        body: l.body,
        exercises: l.exercises || [],
        quizzes: l.quizzes || [],
      })),
    })),
    compiledAt: new Date().toISOString(),
  };
}

function compile(dir) {
  const course = readCourseDir(dir);
  return normalize(course);
}

module.exports = { compile, readCourseDir, normalize, buildConceptIndex, DEFAULT_SKILLS };
