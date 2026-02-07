const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Base path for content on VPS
const CONTENT_BASE_PATH = '/var/www/shef-lms/content';

// Get file icon based on extension
const getFileIcon = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const icons = {
    '.ipynb': '📓',
    '.pdf': '📄',
    '.sql': '🗃️',
    '.py': '🐍',
    '.txt': '📝',
    '.md': '📝',
    '.csv': '📊',
    '.xlsx': '📊',
    '.json': '📋',
    '.pptx': '📽️',
    '.docx': '📄'
  };
  return icons[ext] || '📁';
};

// Get file type for UI display
const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.ipynb': 'Jupyter Notebook',
    '.pdf': 'PDF Document',
    '.sql': 'SQL File',
    '.py': 'Python Script',
    '.txt': 'Text File',
    '.md': 'Markdown',
    '.csv': 'CSV Data',
    '.xlsx': 'Excel Sheet',
    '.json': 'JSON File',
    '.pptx': 'PowerPoint',
    '.docx': 'Word Document'
  };
  return types[ext] || 'File';
};

// Check if file can open in Colab
const canOpenInColab = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.ipynb';
};

// Get list of files for a course
router.get('/:course', (req, res) => {
  const { course } = req.params;
  const coursePath = path.join(CONTENT_BASE_PATH, course);

  // Check if course directory exists
  if (!fs.existsSync(coursePath)) {
    return res.json({ 
      success: false, 
      message: 'Course content not found',
      modules: []
    });
  }

  try {
    // Read modules (directories)
    const modules = fs.readdirSync(coursePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .sort((a, b) => {
        // Sort by module number
        const numA = parseInt(a.name.match(/Module\s*(\d+)/i)?.[1] || 0);
        const numB = parseInt(b.name.match(/Module\s*(\d+)/i)?.[1] || 0);
        return numA - numB;
      })
      .map((dirent, idx) => {
        const modulePath = path.join(coursePath, dirent.name);
        
        // Read files in module
        const files = fs.readdirSync(modulePath)
          .filter(file => {
            const filePath = path.join(modulePath, file);
            return fs.statSync(filePath).isFile();
          })
          .sort((a, b) => {
            // Try to sort by number in filename
            const numA = parseInt(a.match(/^(\d+)/)?.[1] || 999);
            const numB = parseInt(b.match(/^(\d+)/)?.[1] || 999);
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
          })
          .map((file, fileIdx) => ({
            id: fileIdx + 1,
            name: file,
            displayName: file.replace(/^\d+[\.\-_\s]*/, '').replace(/\.[^.]+$/, ''),
            icon: getFileIcon(file),
            type: getFileType(file),
            path: `/content/${course}/${dirent.name}/${file}`,
            canOpenInColab: canOpenInColab(file),
            extension: path.extname(file).toLowerCase()
          }));

        return {
          id: idx + 1,
          name: dirent.name,
          displayName: dirent.name.replace(/Module\s*\d+[\.\-_:\s]*/i, '').trim() || dirent.name,
          filesCount: files.length,
          files: files
        };
      });

    res.json({
      success: true,
      course: course,
      modulesCount: modules.length,
      totalFiles: modules.reduce((sum, m) => sum + m.filesCount, 0),
      modules: modules
    });

  } catch (error) {
    console.error('Error reading course content:', error);
    res.json({
      success: false,
      message: 'Error reading course content',
      error: error.message,
      modules: []
    });
  }
});

// Get file info and Colab URL
router.get('/:course/:module/:filename', (req, res) => {
  const { course, module, filename } = req.params;
  const filePath = path.join(CONTENT_BASE_PATH, course, module, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();

  // For notebooks, provide Colab URL
  let colabUrl = null;
  if (ext === '.ipynb') {
    // Since files are served from the same domain, we use the direct file URL
    // Colab can open files from a URL using ?url=...
    const fileUrl = `https://learnwithus.sbs/content/${course}/${encodeURIComponent(module)}/${encodeURIComponent(filename)}`;
    colabUrl = `https://colab.research.google.com/github/googlecolab/colabtools/blob/master/notebooks/colab-github-demo.ipynb#fileIds=${encodeURIComponent(fileUrl)}`;
  }

  res.json({
    success: true,
    file: {
      name: filename,
      displayName: filename.replace(/^\d+[\.\-_\s]*/, '').replace(/\.[^.]+$/, ''),
      path: `/content/${course}/${module}/${filename}`,
      fullPath: filePath,
      size: stats.size,
      type: getFileType(filename),
      icon: getFileIcon(filename),
      extension: ext,
      canOpenInColab: ext === '.ipynb',
      colabUrl: colabUrl
    }
  });
});

module.exports = router;
