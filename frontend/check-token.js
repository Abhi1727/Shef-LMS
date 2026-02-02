// Script to verify the current JWT token structure
console.log('🔍 Checking current JWT token structure...');

// Get current token from localStorage
const currentToken = localStorage.getItem('token');

if (currentToken) {
  try {
    // Decode JWT token (without verification)
    const payload = JSON.parse(atob(currentToken.split('.')[1]));
    
    console.log('Current JWT payload:', payload.user);
    
    // Check if status field exists
    if (payload.user.status) {
      console.log('✅ Status field found:', payload.user.status);
    } else {
      console.log('❌ Status field MISSING - This is the problem!');
      console.log('🔧 Solution: Clear localStorage and re-login');
    }
    
    // Check role
    if (payload.user.role) {
      console.log('✅ Role found:', payload.user.role);
    } else {
      console.log('❌ Role field missing');
    }
    
  } catch (error) {
    console.error('❌ Error decoding token:', error);
    console.log('🔧 Solution: Token is corrupted - clear and re-login');
  }
} else {
  console.log('ℹ️ No token found - user needs to login');
}

console.log('\n📋 QUICK FIX:');
console.log('1. localStorage.removeItem("token");');
console.log('2. location.reload();');
console.log('3. Login again with credentials');
