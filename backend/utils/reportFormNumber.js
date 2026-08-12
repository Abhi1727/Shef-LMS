/**
 * Persistent per-student Form No. (same idea as enrollment numbers).
 * Format: SS_US_NNNNN  — series starting at 11001
 * One Form No. per student; reused on every report.
 */
const FORM_PREFIX = 'SS_US';
const SERIES_START = 11001;
const FORM_PATTERN = /^SS_US_(\d+)$/i;

function formatFormNo(series) {
  return `${FORM_PREFIX}_${series}`;
}

function parseFormNo(value) {
  if (!value) return null;
  const match = String(value).trim().match(FORM_PATTERN);
  if (!match) return null;
  const series = parseInt(match[1], 10);
  if (!Number.isFinite(series)) return null;
  return { series, formNumber: formatFormNo(series) };
}

function nextSeriesFromExisting(formNumbers = []) {
  let max = SERIES_START - 1;
  for (const value of formNumbers) {
    const parsed = parseFormNo(value);
    if (parsed) max = Math.max(max, parsed.series);
  }
  return max + 1;
}

/**
 * Allocate the next unused Form No. from existing student formNumbers.
 * Does not persist — caller must save onto the user.
 */
async function allocateFormNumber(UserModel) {
  const existing = await UserModel.find({
    role: 'student',
    formNumber: { $regex: /^SS_US_\d+$/i },
  })
    .select('formNumber')
    .lean();

  const series = nextSeriesFromExisting(existing.map((u) => u.formNumber));
  return {
    formNumber: formatFormNo(series),
    series,
  };
}

/**
 * Ensure a student document has a formNumber. Allocates + saves if missing.
 * @returns {Promise<string>} formNumber
 */
async function ensureStudentFormNumber(UserModel, student) {
  const existing = student?.formNumber ? String(student.formNumber).trim() : '';
  if (existing && parseFormNo(existing)) {
    return existing;
  }

  const { formNumber } = await allocateFormNumber(UserModel);
  const id = student?._id || student?.id;
  if (!id) {
    throw new Error('Cannot assign form number without student id');
  }

  await UserModel.findByIdAndUpdate(id, { $set: { formNumber } });
  if (student) student.formNumber = formNumber;
  return formNumber;
}

/**
 * Plan chronological backfill for students missing (or needing) SS_US form numbers.
 * Students that already have a valid SS_US_* keep it; only gaps get new numbers.
 * For a clean "from the start" assign, pass forceResequence=true.
 */
function planFormNumberBackfill(students = [], { forceResequence = false } = {}) {
  const sorted = [...students].sort((a, b) => {
    const da = new Date(a.joiningDate || a.createdAt || 0).getTime();
    const db = new Date(b.joiningDate || b.createdAt || 0).getTime();
    if (da !== db) return da - db;
    return String(a.email || '').localeCompare(String(b.email || ''));
  });

  const assignments = [];
  let series = SERIES_START;

  if (!forceResequence) {
    // Preserve existing SS_US numbers; only assign to those without
    const taken = new Set();
    for (const s of sorted) {
      const parsed = parseFormNo(s.formNumber);
      if (parsed) taken.add(parsed.series);
    }
    const nextFree = () => {
      while (taken.has(series)) series += 1;
      const n = series;
      taken.add(n);
      series += 1;
      return n;
    };

    for (const student of sorted) {
      const previous = student.formNumber ? String(student.formNumber).trim() : '';
      const parsed = parseFormNo(previous);
      if (parsed) {
        assignments.push({
          id: String(student._id || student.id || ''),
          email: student.email,
          name: student.name,
          formNumber: previous,
          series: parsed.series,
          skipped: true,
        });
        continue;
      }
      const n = nextFree();
      assignments.push({
        id: String(student._id || student.id || ''),
        email: student.email,
        name: student.name,
        formNumber: formatFormNo(n),
        series: n,
        previousFormNumber: previous || null,
        skipped: false,
      });
    }
    return { assignments, nextSeries: series };
  }

  // Full resequence from 11001 in join order
  for (const student of sorted) {
    const previous = student.formNumber ? String(student.formNumber).trim() : '';
    const formNumber = formatFormNo(series);
    assignments.push({
      id: String(student._id || student.id || ''),
      email: student.email,
      name: student.name,
      formNumber,
      series,
      previousFormNumber: previous || null,
      skipped: previous === formNumber,
    });
    series += 1;
  }

  return { assignments, nextSeries: series };
}

module.exports = {
  FORM_PREFIX,
  SERIES_START,
  FORM_PATTERN,
  formatFormNo,
  parseFormNo,
  nextSeriesFromExisting,
  allocateFormNumber,
  ensureStudentFormNumber,
  planFormNumberBackfill,
};
