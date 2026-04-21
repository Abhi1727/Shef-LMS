/**
 * Test script to verify timezone parsing fix
 * Tests the new timezone utility functions with various Zoom timestamp formats
 */

// Import the timezone utils
const { parseZoomTimestamp, formatDisplayDate, isValidZoomTimestamp, zoomTimestampToISO } = require('./backend/utils/timezoneUtils');

console.log('=== Timezone Parsing Fix Test ===\n');

// Test cases with various Zoom timestamp formats
const testCases = [
  {
    name: 'Standard UTC timestamp',
    input: '2024-01-15T10:30:00Z',
    expected: '2024-01-15' // Should convert to IST date
  },
  {
    name: 'UTC timestamp with milliseconds',
    input: '2024-01-15T10:30:00.123Z',
    expected: '2024-01-15'
  },
  {
    name: 'Different month',
    input: '2024-03-20T14:45:30Z',
    expected: '2024-03-20'
  },
  {
    name: 'End of month',
    input: '2024-12-31T23:59:59Z',
    expected: '2025-01-01' // Should cross over to next day in IST
  },
  {
    name: 'Invalid timestamp',
    input: 'invalid-date',
    expected: ''
  },
  {
    name: 'Empty string',
    input: '',
    expected: ''
  },
  {
    name: 'Null input',
    input: null,
    expected: ''
  }
];

console.log('Testing parseZoomTimestamp function:');
console.log('=====================================');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = parseZoomTimestamp(testCase.input);
  const passed = result === testCase.expected;
  
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Input: ${testCase.input}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Got: ${result}`);
  console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (passed) passedTests++;
});

console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

// Test other utility functions
console.log('\n=== Testing Other Utility Functions ===');

// Test isValidZoomTimestamp
console.log('\nTesting isValidZoomTimestamp:');
console.log('  Valid timestamp:', isValidZoomTimestamp('2024-01-15T10:30:00Z'));
console.log('  Invalid timestamp:', isValidZoomTimestamp('invalid-date'));
console.log('  Empty string:', isValidZoomTimestamp(''));

// Test zoomTimestampToISO
console.log('\nTesting zoomTimestampToISO:');
console.log('  UTC to ISO:', zoomTimestampToISO('2024-01-15T10:30:00Z'));
console.log('  Invalid input:', zoomTimestampToISO('invalid-date'));

// Test formatDisplayDate (frontend utility)
console.log('\n=== Testing Frontend Date Formatting ===');
// Note: This would be tested in the browser environment
console.log('Frontend dateUtils should be tested in browser environment');

console.log('\n=== Test Complete ===');
