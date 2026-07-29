/**
 * Sky States enrollment numbers.
 * Format: SKY_{MM}_{YYYY}_{NNNN}
 * - MM / YYYY = month & year of joining (Asia/Kolkata), from joiningDate || createdAt
 * - NNNN = global 4-digit series starting at 1101
 */

const ENROLLMENT_PREFIX = 'SKY';
const SERIES_START = 1101;
const SKY_PATTERN = /^SKY_(\d{2})_(\d{4})_(\d{4})$/i;

function padSeries(n) {
  return String(n).padStart(4, '0');
}

/**
 * Extract MM / YYYY in Asia/Kolkata from a date.
 */
function getJoinMonthYear(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return getJoinMonthYear(now);
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());
  return { month, year };
}

function formatEnrollmentNumber(month, year, series) {
  return `${ENROLLMENT_PREFIX}_${month}_${year}_${padSeries(series)}`;
}

function parseSkyEnrollment(value) {
  if (!value) return null;
  const match = String(value).trim().match(SKY_PATTERN);
  if (!match) return null;
  return {
    month: match[1],
    year: match[2],
    series: parseInt(match[3], 10),
  };
}

/**
 * Next global series number from existing enrollmentNumber values.
 */
function nextSeriesFromExisting(enrollmentNumbers = []) {
  let max = SERIES_START - 1;
  for (const value of enrollmentNumbers) {
    const parsed = parseSkyEnrollment(value);
    if (parsed && Number.isFinite(parsed.series)) {
      max = Math.max(max, parsed.series);
    }
  }
  return max + 1;
}

/**
 * Build enrollment number for a join date using a known series integer.
 */
function buildEnrollmentNumber(joinDate, series) {
  const { month, year } = getJoinMonthYear(joinDate);
  return formatEnrollmentNumber(month, year, series);
}

/**
 * Allocate the next enrollment number using a Mongo User model (or collection-like).
 * Uses a find of all SKY_* numbers to compute the next series.
 */
async function allocateEnrollmentNumber(UserModel, joinDate = new Date()) {
  const existing = await UserModel.find({
    enrollmentNumber: { $regex: /^SKY_\d{2}_\d{4}_\d{4}$/i },
  })
    .select('enrollmentNumber')
    .lean();

  const series = nextSeriesFromExisting(existing.map((u) => u.enrollmentNumber));
  return {
    enrollmentNumber: buildEnrollmentNumber(joinDate, series),
    series,
  };
}

/**
 * Plan backfill for a list of student docs sorted by createdAt.
 * Returns assignments + conflicts (non-SKY existing numbers that will be replaced).
 */
function planBackfill(students = []) {
  const sorted = [...students].sort((a, b) => {
    const da = new Date(a.joiningDate || a.createdAt || 0).getTime();
    const db = new Date(b.joiningDate || b.createdAt || 0).getTime();
    if (da !== db) return da - db;
    return String(a.email || '').localeCompare(String(b.email || ''));
  });

  const assignments = [];
  const conflicts = [];
  let series = SERIES_START;

  for (const student of sorted) {
    const joinDate = student.joiningDate || student.createdAt || new Date();
    const previous = student.enrollmentNumber ? String(student.enrollmentNumber).trim() : '';
    const enrollmentNumber = buildEnrollmentNumber(joinDate, series);
    const alreadySky = parseSkyEnrollment(previous);

    if (previous && !alreadySky) {
      conflicts.push({
        id: String(student._id || student.id || ''),
        email: student.email,
        name: student.name,
        previousEnrollmentNumber: previous,
        newEnrollmentNumber: enrollmentNumber,
        reason: 'Replacing legacy non-SKY enrollment number',
      });
    } else if (alreadySky && previous === enrollmentNumber) {
      // Stable if re-run with same ordering — still count series forward
      assignments.push({
        id: String(student._id || student.id || ''),
        email: student.email,
        name: student.name,
        enrollmentNumber,
        series,
        joinDate,
        skipped: true,
        reason: 'Already has matching SKY enrollment number',
      });
      series += 1;
      continue;
    } else if (alreadySky && previous !== enrollmentNumber) {
      conflicts.push({
        id: String(student._id || student.id || ''),
        email: student.email,
        name: student.name,
        previousEnrollmentNumber: previous,
        newEnrollmentNumber: enrollmentNumber,
        reason: 'Re-sequencing existing SKY enrollment number to chronological series',
      });
    }

    assignments.push({
      id: String(student._id || student.id || ''),
      email: student.email,
      name: student.name,
      enrollmentNumber,
      series,
      joinDate,
      previousEnrollmentNumber: previous || null,
      skipped: false,
    });
    series += 1;
  }

  return { assignments, conflicts, nextSeries: series };
}

module.exports = {
  ENROLLMENT_PREFIX,
  SERIES_START,
  SKY_PATTERN,
  getJoinMonthYear,
  formatEnrollmentNumber,
  parseSkyEnrollment,
  nextSeriesFromExisting,
  buildEnrollmentNumber,
  allocateEnrollmentNumber,
  planBackfill,
};
