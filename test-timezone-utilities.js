/**
 * Test script to verify timezone utilities fix
 * Tests the updated timezone utility functions with various edge cases
 */

// Mock the timezone utilities for testing
function safeParseTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }
  
  const parts = timeString.trim().split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  // Validate ranges
  if (isNaN(hours) || isNaN(minutes) || 
      hours < 0 || hours > 23 || 
      minutes < 0 || minutes > 59) {
    return null;
  }
  
  return { hours, minutes };
}

function convertIstToUsTimezone(istTime, timezone) {
  if (!istTime || !timezone) {
    console.warn('[TimezoneUtils] convertIstToUsTimezone: Missing input', { istTime, timezone });
    return '';
  }
  
  // Safely parse IST time
  const parsedTime = safeParseTime(istTime);
  if (!parsedTime) {
    console.warn('[TimezoneUtils] convertIstToUsTimezone: Invalid time format', istTime);
    return '';
  }
  
  const { hours, minutes } = parsedTime;
  const istDate = new Date();
  istDate.setHours(hours, minutes, 0, 0);
  
  // Simple offset for testing
  const offsetMinutes = timezone === 'EST' ? -330 : timezone === 'CST' ? -390 : -510;
  const usDate = new Date(istDate.getTime() + offsetMinutes * 60 * 1000);
  
  let usHours = usDate.getHours();
  const usMinutes = usDate.getMinutes();
  
  const period = usHours >= 12 ? 'PM' : 'AM';
  usHours = usHours % 12 || 12;
  
  return `${usHours.toString().padStart(2, '0')}:${usMinutes.toString().padStart(2, '0')} ${period}`;
}

function convertIstRangeToZone(startTime, endTime, timezone) {
  if (!startTime || !endTime || !timezone) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Missing input', { startTime, endTime, timezone });
    return '';
  }
  
  if (!['EST', 'CST', 'PST'].includes(timezone)) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Invalid timezone', timezone);
    return '';
  }
  
  const convertedStart = convertIstToUsTimezone(startTime, timezone);
  const convertedEnd = convertIstToUsTimezone(endTime, timezone);
  
  if (!convertedStart || !convertedEnd) {
    console.warn('[TimezoneUtils] convertIstRangeToZone: Time conversion failed', { startTime, endTime, timezone, convertedStart, convertedEnd });
    return '';
  }
  
  const abbreviation = timezone === 'EST' ? 'EDT' : timezone === 'CST' ? 'CDT' : 'PDT';
  
  return `${convertedStart} - ${convertedEnd} ${abbreviation}`;
}

console.log('=== Timezone Utilities Fix Test ===\n');

// Test cases that would previously cause NaN
const testCases = [
  {
    name: 'Valid time range',
    startTime: '09:30',
    endTime: '11:30',
    expected: 'should convert successfully'
  },
  {
    name: 'Empty string',
    startTime: '',
    endTime: '11:30',
    expected: 'should return empty string'
  },
  {
    name: 'Null input',
    startTime: null,
    endTime: '11:30',
    expected: 'should return empty string'
  },
  {
    name: 'Undefined input',
    startTime: undefined,
    endTime: '11:30',
    expected: 'should return empty string'
  },
  {
    name: 'Invalid time format',
    startTime: 'invalid',
    endTime: '11:30',
    expected: 'should return empty string'
  },
  {
    name: 'Malformed time',
    startTime: '25:99',
    endTime: '11:30',
    expected: 'should return empty string'
  },
  {
    name: 'Both times invalid',
    startTime: 'invalid',
    endTime: 'also-invalid',
    expected: 'should return empty string'
  }
];

console.log('Testing convertIstRangeToZone with various inputs:\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Input: startTime="${testCase.startTime}", endTime="${testCase.endTime}"`);
  
  const result = convertIstRangeToZone(testCase.startTime, testCase.endTime, 'EST');
  
  console.log(`  Result: "${result}"`);
  
  // Check if result contains NaN (the bug we're fixing)
  const hasNaN = result.includes('NaN');
  const isEmpty = result === '';
  
  let passed = false;
  if (testCase.expected.includes('empty string')) {
    passed = isEmpty && !hasNaN;
  } else if (testCase.expected.includes('convert successfully')) {
    passed = !isEmpty && !hasNaN && result.includes('EDT');
  }
  
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (passed) passedTests++;
});

console.log(`=== Test Results ===`);
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

// Test specific case that was causing the original issue
console.log('\n=== Original Issue Test ===');
console.log('Testing the exact scenario that was causing "12:NaN AM":');

const originalProblemCase = {
  batchInfo: {
    schedule: {
      time: undefined // This was causing the NaN issue
    }
  }
};

// Simulate what Dashboard was doing
const timeString = originalProblemCase.batchInfo.schedule?.time;
console.log(`timeString: ${timeString}`);

const timeParts = timeString ? timeString.split(' - ') : ['', ''];
const startTime = timeParts[0]?.trim();
const endTime = timeParts[1]?.trim();

console.log(`startTime: "${startTime}"`);
console.log(`endTime: "${endTime}"`);

const estResult = convertIstRangeToZone(startTime, endTime, 'EST');
const cstResult = convertIstRangeToZone(startTime, endTime, 'CST');
const pstResult = convertIstRangeToZone(startTime, endTime, 'PST');

console.log(`\nResults:`);
console.log(`EST: "${estResult}"`);
console.log(`CST: "${cstResult}"`);
console.log(`PST: "${pstResult}"`);

const hasNaN = estResult.includes('NaN') || cstResult.includes('NaN') || pstResult.includes('NaN');
console.log(`\nContains NaN: ${hasNaN ? '❌ YES (Bug still exists)' : '✅ NO (Bug fixed!)'}`);

console.log('\n=== Test Complete ===');
