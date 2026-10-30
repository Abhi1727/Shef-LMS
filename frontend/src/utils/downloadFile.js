import { getApiBaseUrl } from './apiBase';

function filenameFromContentDisposition(header) {
  if (!header) return '';
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  const plain = header.match(/filename="([^"]+)"/i);
  try {
    return decodeURIComponent((utf && utf[1]) || (plain && plain[1]) || '');
  } catch (_) {
    return (utf && utf[1]) || (plain && plain[1]) || '';
  }
}

function isNotebookDownload(name, contentType) {
  const n = String(name || '').toLowerCase();
  const ct = String(contentType || '').toLowerCase();
  return (
    n.endsWith('.ipynb') ||
    ct.includes('application/x-ipynb+json') ||
    ct.includes('application/ipynb')
  );
}

/**
 * Download a file through the LMS API with Bearer auth (avoids broken /uploads/ direct links).
 */
export async function downloadAuthenticatedFile(url, { filename, onError } = {}) {
  const token = localStorage.getItem('token');
  const apiUrl = getApiBaseUrl();
  const fullUrl = url.startsWith('http') ? url : `${apiUrl}${url.startsWith('/') ? url : `/${url}`}`;

  const response = await fetch(fullUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache'
    }
  });

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const isAttachment = /attachment/i.test(contentDisposition);
  const dispositionName = filenameFromContentDisposition(contentDisposition);
  const hintedName = dispositionName || filename || '';

  if (!response.ok) {
    const errBody = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
    throw new Error(errBody.message || `Download failed (${response.status})`);
  }

  // .ipynb is JSON under the hood — do not treat attachment/notebook responses as API errors.
  const notebook = isNotebookDownload(hintedName, contentType);
  if (contentType.includes('application/json') && !isAttachment && !notebook) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || 'File is not available on the server');
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error('Downloaded file is empty');

  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const looksZip = header[0] === 0x50 && header[1] === 0x4b;
  const looksPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
  const typeProbe = `${blob.type || ''} ${contentType}`;
  if (/html|text\/html/.test(typeProbe) && !looksZip && !looksPdf) {
    throw new Error('Server returned an error instead of the file');
  }
  // Plain application/json without attachment/notebook usually means an error payload
  if (
    /application\/json/.test(typeProbe) &&
    !looksZip &&
    !looksPdf &&
    !isAttachment &&
    !notebook
  ) {
    throw new Error('Server returned an error instead of the file');
  }

  // Preserve the original file format:
  // 1. Start from hinted name or fallback
  let name = hintedName || 'download';

  // 2. Clean up any spurious trailing .zip appended to known document/notebook/code formats
  name = name.replace(/\.(docx|pptx|xlsx|pdf|ipynb|doc|ppt|xls|txt|csv|py|json|md|rtf)\.zip$/i, '.$1');

  // 3. Map MIME types to canonical extensions
  const mimeToExt = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/csv': '.csv',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/x-ipynb+json': '.ipynb',
    'application/json': '.json',
    'text/x-python': '.py',
    'application/vnd.rar': '.rar',
    'application/x-7z-compressed': '.7z',
    'text/markdown': '.md',
    'application/rtf': '.rtf'
  };

  const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(name);
  if (!hasExt) {
    const cleanMime = String(contentType || '').split(';')[0].trim().toLowerCase();
    const ext = mimeToExt[cleanMime];
    if (ext) {
      name = `${name}${ext}`;
    } else if (looksPdf) {
      name = `${name}.pdf`;
    } else if (notebook || (header[0] === 0x7b && (hintedName.includes('ipynb') || contentType.includes('json')))) {
      name = `${name}.ipynb`;
    } else if (looksZip) {
      name = `${name}.zip`;
    }
  } else if (/\.zip$/i.test(name) && looksPdf) {
    // If filename was named .zip but payload is actually a PDF, maintain actual PDF format
    name = name.replace(/\.zip$/i, '.pdf');
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(objectUrl);
  }, 100);

  return { filename: name, size: blob.size };
}

export function uploadPathWithToken(relativePath) {
  const token = localStorage.getItem('token');
  const base = getApiBaseUrl();
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (!token) return `${base}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}token=${encodeURIComponent(token)}`;
}
