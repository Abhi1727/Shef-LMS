const path = require('path');
const fs = require('fs');

/**
 * Resolve content root for course notebooks and static learning materials.
 * Prefers CONTENT_ROOT env, then /app/content (Docker mount), then repo ../content.
 */
function getContentRoot() {
  if (process.env.CONTENT_ROOT) {
    return path.resolve(process.env.CONTENT_ROOT);
  }

  const dockerPath = path.join(__dirname, '..', 'content');
  if (fs.existsSync(dockerPath)) {
    return dockerPath;
  }

  const monorepoPath = path.join(__dirname, '..', '..', 'content');
  return monorepoPath;
}

/**
 * Resolve a relative content path safely (no path traversal).
 * @param {string} relativePath e.g. course-notebooks/data-science-ai/module-01-python/foo.ipynb
 * @returns {string|null} absolute path or null if invalid/missing
 */
function resolveContentFile(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;

  const root = getContentRoot();
  const cleaned = relativePath.replace(/^\/+/, '');
  const absolute = path.resolve(root, cleaned);
  const rootResolved = path.resolve(root);

  if (!absolute.startsWith(rootResolved + path.sep) && absolute !== rootResolved) {
    return null;
  }

  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return null;
  }

  return absolute;
}

module.exports = {
  getContentRoot,
  resolveContentFile
};
