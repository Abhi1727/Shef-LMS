/**
 * Branded HTML wrapper for admin batch emails (Sky States LMS).
 */

const LMS_URL = process.env.LMS_PUBLIC_URL || 'https://learnwithus.sbs';
const SUPPORT_EMAIL = 'support@skystates.us';
const SUPPORT_PHONE = '(888) 810-2434';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInline(text) {
  let out = escapeHtml(text);
  out = out.replace(
    /(https?:\/\/[^\s<]+)/gi,
    '<a href="$1" style="color:#0f766e;text-decoration:underline;">$1</a>'
  );
  out = out.replace(/\n/g, '<br>');
  return out;
}

function isTimingBlock(paragraph) {
  const p = paragraph.toLowerCase();
  return (
    p.startsWith('📅') ||
    p.includes('est:') ||
    p.includes('est\t') ||
    /\b(est|cst|mst|pst)\b/i.test(p) ||
    p.includes('class timings') ||
    p.includes('us timings') ||
    (p.includes('ist:') && (p.includes('est') || p.includes('am') || p.includes('pm')))
  );
}

function renderTimingBlock(paragraph) {
  const lines = paragraph.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines
    .map((line) => {
      const cleaned = line.replace(/^🕒\s*/, '');
      const zoneMatch =
        cleaned.match(/^([A-Za-z]{2,5})\s*[:\t]\s*(.*)$/) ||
        cleaned.match(/^([A-Za-z]{2,5})\s{2,}(.*)$/);
      if (zoneMatch && !/^Class/i.test(zoneMatch[1])) {
        const label = zoneMatch[1].trim();
        const value = zoneMatch[2].trim();
        return `
        <tr>
          <td style="padding:6px 14px 6px 0;font-size:13px;font-weight:700;color:#486581;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-size:13px;color:#102a33;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`;
      }
      if (!cleaned.includes(':') || /^Class\s+timings/i.test(cleaned)) {
        return `
        <tr>
          <td colspan="2" style="padding:6px 0;font-size:13px;font-weight:700;color:#0b3d4a;vertical-align:top;">${formatInline(cleaned)}</td>
        </tr>`;
      }
      const [label, ...rest] = cleaned.split(':');
      const value = rest.join(':').trim();
      return `
        <tr>
          <td style="padding:6px 14px 6px 0;font-size:13px;font-weight:700;color:#486581;white-space:nowrap;vertical-align:top;">${escapeHtml(label.trim())}</td>
          <td style="padding:6px 0;font-size:13px;color:#102a33;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f0f9f9;border:1px solid #c6e8e8;border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td>
      </tr>
    </table>`;
}

function renderStepsBlock(paragraph) {
  const items = paragraph
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^\d+[\.)]\s/.test(l));
  if (!items.length) return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#243b53;">${formatInline(paragraph)}</p>`;

  const lis = items
    .map((item) => {
      const text = item.replace(/^\d+[\.)]\s*/, '');
      return `<li style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#243b53;">${formatInline(text)}</li>`;
    })
    .join('');

  return `
    <ol style="margin:12px 0 16px;padding-left:22px;">
      ${lis}
    </ol>`;
}

function shouldShowLmsCta(message, subject) {
  const blob = `${message}\n${subject}`.toLowerCase();
  return (
    blob.includes('lms') ||
    blob.includes('learnwithus') ||
    blob.includes('enter classroom') ||
    blob.includes('join through') ||
    blob.includes('zoom')
  );
}

function buildBodyHtml(message) {
  const rawParagraphs = String(message || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Group consecutive timing/date paragraphs into a single unified block
  const paragraphs = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const current = rawParagraphs[i];
    if (isTimingBlock(current)) {
      let combined = current;
      while (i + 1 < rawParagraphs.length && isTimingBlock(rawParagraphs[i + 1])) {
        i++;
        combined += '\n' + rawParagraphs[i];
      }
      paragraphs.push(combined);
    } else {
      paragraphs.push(current);
    }
  }

  return paragraphs
    .map((para) => {
      if (/^\d+[\.)]\s/m.test(para)) return renderStepsBlock(para);
      if (isTimingBlock(para)) return renderTimingBlock(para);
      if (/^important:/i.test(para)) {
        return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
            <tr>
              <td style="padding:12px 14px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:8px;font-size:13px;line-height:1.55;color:#7c2d12;">
                ${formatInline(para)}
              </td>
            </tr>
          </table>`;
      }
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#243b53;">${formatInline(para)}</p>`;
    })
    .join('');
}

function formatBatchEmailHtml(message, options = {}) {
  const lmsUrl = options.lmsUrl || LMS_URL;
  const subject = options.subject || 'Sky States LMS';
  const bodyHtml = buildBodyHtml(message);
  const showCta = options.showCta !== false && shouldShowLmsCta(message, subject);

  const ctaBlock = showCta
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(lmsUrl)}" style="display:inline-block;padding:12px 28px;background:#147a7a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;">
              Open Sky States LMS
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:8px;font-size:12px;color:#627d98;">
            Sign in, then join your live class from the dashboard
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d9e2ec;box-shadow:0 4px 24px rgba(16,42,67,0.08);">
          <tr>
            <td style="padding:22px 28px;background:linear-gradient(135deg,#035388 0%,#0b6e99 55%,#147a7a 100%);">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:700;">Sky States</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">Learning Management System</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              ${bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6eef1;margin-top:8px;padding-top:16px;">
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#627d98;">
                    <strong style="color:#102a33;">Sky States Team</strong><br>
                    <a href="mailto:${SUPPORT_EMAIL}" style="color:#147a7a;text-decoration:none;">${SUPPORT_EMAIL}</a>
                    &nbsp;·&nbsp; ${SUPPORT_PHONE}<br>
                    <a href="${escapeHtml(lmsUrl)}" style="color:#147a7a;text-decoration:none;">${escapeHtml(lmsUrl.replace(/^https?:\/\//, ''))}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9fb3c8;max-width:600px;line-height:1.5;">
          You received this message because you are enrolled in a Sky States program.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  formatBatchEmailHtml,
  LMS_URL
};
