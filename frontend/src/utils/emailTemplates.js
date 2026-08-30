import {
  convertIstRangeToUsTimezones,
  parseTimeRange
} from './timezoneUtils';

const DRAFTS_STORAGE_KEY = 'sky-states-email-drafts-v1';

export const PLATFORM_OPTIONS = ['Zoom', 'Google Meet'];

export const IST_TIME_PRESETS = [
  { id: 'ist-6-8', label: '6:00 AM – 8:00 AM IST', istTimeRange: '6:00 AM - 8:00 AM' },
  { id: 'ist-7-9', label: '7:00 AM – 9:00 AM IST', istTimeRange: '7:00 AM - 9:00 AM' },
  { id: 'ist-8-10', label: '8:00 AM – 10:00 AM IST', istTimeRange: '8:00 AM - 10:00 AM' },
  { id: 'ist-9-11', label: '9:00 AM – 11:00 AM IST', istTimeRange: '9:00 AM - 11:00 AM' },
  { id: 'ist-10-12', label: '10:00 AM – 12:00 PM IST', istTimeRange: '10:00 AM - 12:00 PM' },
  { id: 'ist-6-8pm', label: '6:00 PM – 8:00 PM IST', istTimeRange: '6:00 PM - 8:00 PM' },
  { id: 'ist-7-9pm', label: '7:00 PM – 9:00 PM IST', istTimeRange: '7:00 PM - 9:00 PM' }
];

export const EMAIL_PLACEHOLDERS = [
  { key: 'course', label: 'Course / program' },
  { key: 'batchName', label: 'Batch name' },
  { key: 'classDates', label: 'Class dates' },
  { key: 'platform', label: 'Platform' },
  { key: 'lmsUrl', label: 'LMS login URL' },
  { key: 'scheduleDays', label: 'Weekly schedule days' },
  { key: 'istTimeRange', label: 'Class time (IST)' },
  { key: 'estTime', label: 'EST timing' },
  { key: 'cstTime', label: 'CST timing' },
  { key: 'mstTime', label: 'MST timing' },
  { key: 'pstTime', label: 'PST timing' }
];

export const EMAIL_EDITABLE_FIELDS = [
  { key: 'course', label: 'Course / program' },
  { key: 'batchName', label: 'Batch name' },
  { key: 'classDates', label: 'Class dates', placeholder: 'e.g. Saturday & Sunday, 8 & 9 August 2026' },
  { key: 'scheduleDays', label: 'Weekly days' }
];

export const US_TIMING_KEYS = [
  { key: 'estTime', label: 'EST' },
  { key: 'cstTime', label: 'CST' },
  { key: 'mstTime', label: 'MST' },
  { key: 'pstTime', label: 'PST' }
];

const LMS_PUBLIC_URL =
  typeof window !== 'undefined' && window.location.hostname.includes('dev.')
    ? 'https://dev.learnwithus.sbs'
    : 'https://learnwithus.sbs';

export const BUILTIN_EMAIL_TEMPLATES = [
  {
    id: 'zoom-lms-join',
    name: 'Join via LMS (Zoom) — recommended',
    subject: 'Live class — join through Sky States LMS · {{course}}',
    message: `Dear Students,

Your {{course}} live class is scheduled for {{classDates}}.

Please join through the Sky States LMS so your attendance is recorded automatically.

How to join (Zoom via LMS):
1. Sign in at {{lmsUrl}}
2. On your dashboard, open the Live class section when the session is about to start
3. Click Enter classroom to join inside the LMS (Zoom)
4. Join at least 5 minutes before the scheduled time

Class timings:

IST: {{istTimeRange}}
EST: {{estTime}}
CST: {{cstTime}}
MST: {{mstTime}}
PST: {{pstTime}}

Important: Always join through the LMS first. Do not use an external Zoom link unless your trainer asks you to for technical support.

We look forward to seeing you in class.

Warm regards,
Sky States Team
support@skystates.us
(888) 810-2434`
  },
  {
    id: 'class-announcement',
    name: 'Class announcement (weekend)',
    subject: 'Class schedule — {{course}}',
    message: `Dear Students,

This is to inform you that the {{course}} regular class will be held on {{classDates}}.

Platform: {{platform}} (join through {{lmsUrl}})

Class timings:

IST: {{istTimeRange}}
EST: {{estTime}}
CST: {{cstTime}}
MST: {{mstTime}}
PST: {{pstTime}}

Please join the session 5 minutes before the scheduled time through your LMS dashboard.

Looking forward to seeing you in class.

Warm regards,
Sky States Team
support@skystates.us
(888) 810-2434`
  },
  {
    id: 'class-reminder',
    name: 'Short class reminder',
    subject: 'Reminder: {{course}} class — {{classDates}}',
    message: `Dear Students,

Quick reminder for {{batchName}}: class on {{classDates}}.

Join through the LMS: {{lmsUrl}}
Platform: {{platform}}

Class timings:

IST: {{istTimeRange}}
EST: {{estTime}}
CST: {{cstTime}}
MST: {{mstTime}}
PST: {{pstTime}}

Please join 5 minutes early from your dashboard.

Sky States Team
support@skystates.us`
  },
  {
    id: 'blank',
    name: 'Blank compose',
    subject: '',
    message: ''
  }
];

function normalizeTimeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim()
    .toLowerCase();
}

function usZoneLines(istTimeRange) {
  const { startTime, endTime } = parseTimeRange(istTimeRange);
  if (!startTime || !endTime) {
    return { estTime: '', cstTime: '', mstTime: '', pstTime: '' };
  }
  const zones = convertIstRangeToUsTimezones(startTime, endTime);
  return {
    estTime: zones.EST?.range || '',
    cstTime: zones.CST?.range || '',
    mstTime: zones.MST?.range || '',
    pstTime: zones.PST?.range || ''
  };
}

export function getIstTimeOptions(batch = null) {
  const options = [];
  const batchTime = batch?.schedule?.time?.trim();
  if (batchTime) {
    options.push({
      id: 'batch-schedule',
      label: `Batch schedule (${batchTime})`,
      istTimeRange: batchTime
    });
  }
  IST_TIME_PRESETS.forEach((preset) => {
    options.push({
      id: preset.id,
      label: preset.label,
      istTimeRange: preset.istTimeRange
    });
  });
  options.push({ id: 'custom', label: 'Custom IST time…', istTimeRange: '' });
  return options;
}

export function resolveIstOptionId(istTimeRange, batch = null) {
  const normalized = normalizeTimeText(istTimeRange);
  if (!normalized) {
    const options = getIstTimeOptions(batch);
    return options[0]?.id || 'custom';
  }
  const match = getIstTimeOptions(batch).find(
    (opt) => opt.id !== 'custom' && normalizeTimeText(opt.istTimeRange) === normalized
  );
  return match?.id || 'custom';
}

export function defaultEmailVariables(batch = null) {
  const course = batch?.course || '';
  const batchName = batch?.name || '';
  const scheduleDays = batch?.schedule?.days || '';
  const istTimeRange = batch?.schedule?.time || '';
  const zoneLines = usZoneLines(istTimeRange);

  return {
    course,
    batchName,
    classDates: '',
    platform: 'Zoom',
    lmsUrl: LMS_PUBLIC_URL,
    scheduleDays,
    istTimeRange,
    ...zoneLines
  };
}

export function applyEmailTemplate(text, variables = {}) {
  if (!text) return '';
  let out = String(text);
  EMAIL_PLACEHOLDERS.forEach(({ key }) => {
    const value = variables[key] != null ? String(variables[key]) : '';
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
  });
  return out;
}

export function loadEmailDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEmailDraft(draft) {
  const drafts = loadEmailDrafts();
  const next = {
    id: draft.id || `draft-${Date.now()}`,
    name: draft.name || 'Untitled draft',
    templateId: draft.templateId || '',
    subject: draft.subject || '',
    message: draft.message || '',
    variables: draft.variables || {},
    istTimeOptionId: draft.istTimeOptionId || '',
    savedAt: new Date().toISOString()
  };
  const idx = drafts.findIndex((d) => d.id === next.id);
  if (idx >= 0) drafts[idx] = next;
  else drafts.unshift(next);
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts.slice(0, 30)));
  return next;
}

export function deleteEmailDraft(id) {
  const drafts = loadEmailDrafts().filter((d) => d.id !== id);
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  return drafts;
}

export function getBuiltinTemplate(id) {
  return BUILTIN_EMAIL_TEMPLATES.find((t) => t.id === id) || null;
}

export function recalcUsTimings(variables) {
  const zoneLines = usZoneLines(variables.istTimeRange);
  return { ...variables, ...zoneLines };
}

export function applyTemplateToForm(templateId, variables, fallback = { subject: '', message: '' }) {
  const tpl = getBuiltinTemplate(templateId);
  const vars = recalcUsTimings(variables);
  if (!tpl || templateId === 'blank') {
    return {
      subject: applyEmailTemplate(fallback.subject, vars),
      message: applyEmailTemplate(fallback.message, vars),
      variables: vars
    };
  }
  return {
    subject: applyEmailTemplate(tpl.subject, vars),
    message: applyEmailTemplate(tpl.message, vars),
    variables: vars
  };
}
