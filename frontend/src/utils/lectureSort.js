/** Class date in ms; supports YYYY-MM-DD, DD-MM-YYYY (one-to-one classDate) and ISO. */
export function lectureClassTime(v) {
  const raw = (v?.isOneToOne && v?.classDate) || v?.date || v?.classDate || v?.createdAt || v?.addedAt || 0;
  if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('-');
    return new Date(`${yyyy}-${mm}-${dd}`).getTime() || 0;
  }
  return new Date(raw).getTime() || 0;
}

/** Latest class first; same day → higher lesson order, then most recently created. */
export function compareLecturesNewestFirst(a, b) {
  const d = lectureClassTime(b) - lectureClassTime(a);
  if (d !== 0) return d;
  const o = (Number(b?.order) || 0) - (Number(a?.order) || 0);
  if (o !== 0) return o;
  return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
}

export function sortLecturesNewestFirst(list) {
  return [...(list || [])].sort(compareLecturesNewestFirst);
}
