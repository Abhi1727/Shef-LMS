#!/usr/bin/env node

/**
 * Test script for password update endpoint
 * Tests the enhanced error handling and JSON response validation
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Sample MongoDB ObjectId
const TEST_TOKEN = 'test-admin-token'; // This would need to be a valid admin token

async function testPasswordUpdateEndpoint() {
  console.log('🔧 Testing Password Update Endpoint\n');
  
  const testCases = [
    {
      name: 'Valid Password Update',
      data: {
        newPassword: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      },
      expectedStatus: 200
    },
    {
      name: 'Missing Password Fields',
      data: {},
      expectedStatus: 400
    },
    {
      name: 'Password Mismatch',
      data: {
        newPassword: 'TestPassword123!',
        confirmPassword: 'DifferentPassword123!'
      },
      expectedStatus: 400
    },
    {
      name: 'Weak Password',
      data: {
        newPassword: 'weak',
        confirmPassword: 'weak'
      },
      expectedStatus: 400
    },
    {
      name: 'Invalid Request Body (non-JSON)',
      data: null,
      expectedStatus: 400,
      skipJsonStringify: true
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      const url = `${API_BASE_URL}/api/admin/users/${TEST_USER_ID}/password`;
      
      let body;
      let headers = {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      };

      if (testCase.skipJsonStringify) {
        // Send invalid JSON
        headers['Content-Type'] = 'text/plain';
        body = 'invalid json';
      } else {
        body = JSON.stringify(testCase.data);
      }

      console.log(`🌐 Request: ${url}`);
      console.log(`📦 Body: ${body}`);
      console.log(`🔒 Headers:`, headers);

      const response = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: body
      });

      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Headers:`, response.headers.raw());

      const responseText = await response.text();
      console.log(`💬 Response: ${responseText}`);

      // Test if response is valid JSON
      try {
        const responseData = JSON.parse(responseText);
        console.log('✅ Response is valid JSON');
        console.log('📝 Parsed data:', responseData);
        
        if (response.status === testCase.expectedStatus) {
          console.log('✅ Test passed: Expected status received');
        } else {
          console.log(`❌ Test failed: Expected ${testCase.expectedStatus}, got ${response.status}`);
        }
      } catch (parseError) {
        console.log('❌ Response is NOT valid JSON');
        console.log('🔍 Parse error:', parseError.message);
        
        if (testCase.expectedStatus !== 200) {
          console.log('⚠️  This might be expected for error cases');
        } else {
          console.log('❌ Test failed: Expected valid JSON response');
        }
      }

    } catch (error) {
      console.log('🚨 Network error:', error.message);
      console.log('🔍 Error details:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');
    
    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🏁 Testing completed!');
}

// Test the enhanced error handling by simulating various scenarios
async function testErrorHandling() {
  console.log('🔧 Testing Enhanced Error Handling\n');

  // Test 1: Non-existent user
  console.log('📋 Testing: Non-existent user');
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/507f1f77bcf86cd799439999/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newPassword: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      })
    });

    const responseText = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${responseText}`);

    try {
      JSON.parse(responseText);
      console.log('✅ Error response is valid JSON');
    } catch (parseError) {
      console.log('❌ Error response is NOT valid JSON:', parseError.message);
    }

  } catch (error) {
    console.log('Network error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

// Test the request logging functionality
async function testRequestLogging() {
  console.log('🔧 Testing Request Logging\n');

  const logApiRequest = async (url, options, response) => {
    console.log('=== API Request Debug ===');
    console.log('URL:', url);
    console.log('Method:', options.method);
    console.log('Headers:', options.headers);
    console.log('Request Body:', options.body);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers.raw());
    
    try {
      const responseText = await response.text();
      console.log('Response Body:', responseText);
      
      // Try to parse as JSON to validate
      try {
        JSON.parse(responseText);
        console.log('✅ Response is valid JSON');
      } catch (jsonError) {
        console.log('❌ Response is NOT valid JSON:', jsonError.message);
      }
      
      return responseText; // Return the text so we can use it later
    } catch (error) {
      console.log('Could not read response body:', error.message);
      return null;
    }
    console.log('=== End Debug ===');
  };

  try {
    const url = `${API_BASE_URL}/api/admin/users/${TEST_USER_ID}/password`;
    const options = {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newPassword: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      })
    };

    const response = await fetch(url, options);
    await logApiRequest(url, options, response);

  } catch (error) {
    console.log('Network error during logging test:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}

// Main execution
async function main() {
  console.log('🚀 Starting Password Update Endpoint Tests\n');
  
  await testPasswordUpdateEndpoint();
  await testErrorHandling();
  await testRequestLogging();
  
  console.log('✅ All tests completed!');
  console.log('\n📝 Summary:');
  console.log('- Tested valid password update requests');
  console.log('- Tested error handling for invalid requests');
  console.log('- Tested JSON response validation');
  console.log('- Tested request logging functionality');
  console.log('\n🔧 If tests show "Failed to fetch" errors, ensure the backend server is running on localhost:5000');
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testPasswordUpdateEndpoint,
  testErrorHandling,
  testRequestLogging
};
