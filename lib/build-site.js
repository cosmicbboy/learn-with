// learn-with: multi-course site builder for static hosting (GitHub Pages, etc.).
// Every course under courses/ compiles to <outDir>/<course-id>/ (its own SPA),
// and <outDir>/index.html becomes a hub that lists all courses via courses.json.

const fs = require('fs');
const path = require('path');
const { compile } = require('./compile');
const { emitStatic } = require('./emit-static');

const COURSES_ROOT = path.join(__dirname, '..', 'courses');
const HOME_TEMPLATE = path.join(__dirname, '..', 'ui', 'home.html');

// Discover course directories (those containing a course manifest).
function listCourses() {
  return fs.readdirSync(COURSES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(COURSES_ROOT, d.name, 'course.hl.yml')))
    .map((d) => d.name)
    .sort();
}

// Summarise a course for the hub (no heavy per-lesson bodies/exercises).
function summarize(course) {
  let exercises = 0;
  for (const m of course.modules) for (const l of m.lessons) exercises += (l.exercises || []).length + (l.quizzes || []).length;
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle || '',
    author: course.author || 'learn-with',
    blurb: course.blurb || '',
    persona: course.persona || {},
    defaultDifficulty: course.defaultDifficulty || 2,
    project: course.project || { repo: '', note: '' },
    modules: course.modules.length,
    lessons: course.modules.reduce((a, m) => a + m.lessons.length, 0),
    exercises,
    firstLesson: (() => {
      const m = course.modules[0];
      if (!m || !m.lessons.length) return '';
      return `${m.id}/${m.lessons[0].id}`;
    })(),
  };
}

function buildSite(outDir) {
  // regenerate from scratch so no stale single-course assets linger at the root
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const ids = listCourses();
  if (!ids.length) throw new Error('no courses found under courses/ (missing course.hl.yml)');

  const courses = [];
  for (const id of ids) {
    const courseDir = path.join(COURSES_ROOT, id);
    const course = compile(courseDir);
    // each course is a self-contained SPA under <outDir>/<id>/
    emitStatic(courseDir, path.join(outDir, id));
    courses.push(summarize(course));
  }

  fs.writeFileSync(path.join(outDir, 'courses.json'), JSON.stringify(courses, null, 2));

  // copy the brand logo to the hub root (home.html references it as favicon)
  fs.copyFileSync(path.join(__dirname, '..', 'ui', 'logo.svg'), path.join(outDir, 'logo.svg'));

  // hub home page
  let html = fs.readFileSync(HOME_TEMPLATE, 'utf8');
  const v = Date.now();
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  return {
    courses,
    outDir,
    lessons: courses.reduce((a, c) => a + c.lessons, 0),
    exercises: courses.reduce((a, c) => a + c.exercises, 0),
  };
}

module.exports = { buildSite, listCourses, summarize };
