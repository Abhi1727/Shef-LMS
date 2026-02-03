const videoProcessor = (req, res, next) => {
  console.log('🔐 Middleware - ANY REQUEST:', req.method, req.path);
  
  // Only process classroom video requests
  if (req.path.includes('/classroom') && (req.method === 'POST' || req.method === 'PUT')) {
    console.log('🔐 Middleware - Request received:');
    console.log('  Method:', req.method);
    console.log('  Path:', req.path);
    console.log('  Original zoomUrl:', req.body.zoomUrl);
    console.log('  Original zoomPasscode:', req.body.zoomPasscode);
    
    // If zoomUrl is provided but no zoomPasscode, try to extract
    if (req.body.zoomUrl && !req.body.zoomPasscode) {
      console.log('🔐 Middleware - Attempting extraction...');
      const extracted = extractZoomDetails(req.body.zoomUrl);
      console.log('🔐 Middleware - Extraction result:', extracted);
      
      if (extracted.url && extracted.passcode) {
        req.body.zoomUrl = extracted.url;
        req.body.zoomPasscode = extracted.passcode;
        console.log('🔐 Middleware - Successfully extracted:');
        console.log('  URL:', extracted.url);
        console.log('  Passcode:', extracted.passcode);
      } else {
        console.log('🔐 Middleware - Could not extract passcode from URL');
        console.log('🔐 Original URL:', req.body.zoomUrl);
      }
    }
    
    // Log what's being saved
    console.log('🔐 Middleware - Final data being saved:');
    console.log('  zoomUrl:', req.body.zoomUrl);
    console.log('  zoomPasscode:', req.body.zoomPasscode);
  }
  
  next();
};

// Extract URL and passcode from Zoom's format
function extractZoomDetails(input) {
  let url = '';
  let passcode = '';
  
  // Try to match the pattern: URL Passcode: CODE
  const match = input.match(/(https?:\/\/[^\s]+)\s+Passcode:\s*(.+)/);
  
  if (match) {
    url = match[1].trim();
    passcode = match[2].trim();
  } else {
    // If no passcode found, treat entire value as URL
    url = input.trim();
    passcode = '';
  }
  
  return { url, passcode };
}

module.exports = videoProcessor;
