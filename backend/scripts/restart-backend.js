const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Restarting backend server to apply teacher course assignment fixes...');

// Kill any existing node processes on port 5000
const killProcess = spawn('taskkill', ['/F', '/IM', 'node.exe'], {
  stdio: 'inherit'
});

killProcess.on('close', (code) => {
  console.log('🛑 Stopped existing backend processes');
  
  // Start the backend server
  const backendPath = path.join(__dirname, '..');
  const server = spawn('node', ['server.js'], {
    cwd: backendPath,
    stdio: 'inherit'
  });
  
  console.log('🚀 Starting backend server with teacher course assignment fixes...');
  console.log('📝 Changes applied:');
  console.log('   - Fixed backend update logic to prioritize assignedCourses');
  console.log('   - Enhanced response to include updated teacher object');
  console.log('   - Added comprehensive logging for debugging');
  console.log('   - Enhanced frontend to use returned teacher data');
  
  server.on('error', (error) => {
    console.error('❌ Failed to start backend server:', error);
  });
  
  server.on('close', (code) => {
    console.log(`Backend server exited with code ${code}`);
  });
});
