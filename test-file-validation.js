// Test file validation logic
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const validateFile = (file) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/x-python',
    'application/json' // For .ipynb files
  ];
  
  // Check file size
  if (file.size > maxSize) {
    return `File size (${formatFileSize(file.size)}) exceeds 10MB limit`;
  }
  
  // Enhanced file type validation with extension fallback
  const fileExtension = file.name.toLowerCase().split('.').pop();
  const allowedExtensions = [
    'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 
    'zip', 'jpg', 'jpeg', 'png', 'gif', 'ipynb'
  ];
  
  // Check MIME type first, then extension as fallback
  const isValidMimeType = allowedTypes.includes(file.type);
  const isValidExtension = allowedExtensions.includes(fileExtension);
  
  if (!isValidMimeType && !isValidExtension) {
    return `File type not supported. Allowed types: ${allowedExtensions.join(', ')}`;
  }
  
  // Additional validation for specific file types
  if (fileExtension === 'ipynb' && file.type !== 'application/json' && !file.type.includes('text')) {
    console.warn('Jupyter notebook MIME type warning:', file.type);
    // Allow but log warning for .ipynb files
  }
  
  return null; // No error
};

// Test cases
const testCases = [
  {
    name: 'Valid PDF file',
    file: { name: 'document.pdf', type: 'application/pdf', size: 1024 * 1024 }
  },
  {
    name: 'Valid Jupyter notebook',
    file: { name: 'analysis.ipynb', type: 'application/json', size: 512 * 1024 }
  },
  {
    name: 'Jupyter notebook with wrong MIME type',
    file: { name: 'notebook.ipynb', type: 'text/plain', size: 256 * 1024 }
  },
  {
    name: 'File too large',
    file: { name: 'large.pdf', type: 'application/pdf', size: 15 * 1024 * 1024 }
  },
  {
    name: 'Unsupported file type',
    file: { name: 'video.mp4', type: 'video/mp4', size: 1024 * 1024 }
  },
  {
    name: 'Valid ZIP file',
    file: { name: 'archive.zip', type: 'application/zip', size: 5 * 1024 * 1024 }
  },
  {
    name: 'Valid image file',
    file: { name: 'photo.png', type: 'image/png', size: 2 * 1024 * 1024 }
  }
];

console.log('🧪 Testing File Validation Logic\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`File: ${testCase.file.name} (${testCase.file.type}, ${formatFileSize(testCase.file.size)})`);
  
  const error = validateFile(testCase.file);
  
  if (error) {
    console.log(`❌ Result: ${error}\n`);
  } else {
    console.log('✅ Result: Validation passed\n');
  }
});

console.log('📋 Summary:');
console.log('- All valid file types should pass validation');
console.log('- Files > 10MB should fail with size error');
console.log('- Unsupported types should fail with type error');
console.log('- .ipynb files should pass with extension fallback');
