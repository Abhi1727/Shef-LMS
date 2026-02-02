#!/usr/bin/env node

/**
 * YouTube OAuth Setup Helper
 * Run this script to get your YouTube refresh token
 */

const { google } = require('googleapis');
require('dotenv').config();

// Check if credentials are set
if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
  console.error('❌ Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env file first!');
  console.log('\n📝 Get credentials from: https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}

// Create OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/auth/youtube/callback'
);

// Scopes needed for YouTube upload
const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent' // Important for getting refresh token
});

console.log('🔗 YouTube OAuth Setup');
console.log('='.repeat(50));
console.log('\n1️⃣  Visit this URL to authorize the application:');
console.log('\n' + authUrl + '\n');

console.log('2️⃣  After authorization, you will be redirected to:');
console.log('   ' + (process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/auth/youtube/callback'));
console.log('\n3️⃣  Copy the "code" parameter from the redirect URL');
console.log('\n4️⃣  Run: node setup-youtube-token.js YOUR_CODE_HERE');
console.log('\n' + '='.repeat(50));

// Handle code exchange if provided as argument
if (process.argv[2]) {
  const code = process.argv[2];
  console.log('\n🔄 Exchanging code for tokens...');
  
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('❌ Error retrieving access token:', err.message);
      return;
    }
    
    console.log('\n✅ Success! Here are your tokens:');
    console.log('\n📝 Add this to your .env file:');
    console.log('YOUTUBE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n🎉 Your YouTube API is now configured!');
    
    // Test the credentials
    oauth2Client.setCredentials(tokens);
    console.log('\n🧪 Testing API access...');
    
    const youtube = google.youtube('v3');
    youtube.channels.list({
      auth: oauth2Client,
      part: 'snippet',
      mine: true
    }, (err, response) => {
      if (err) {
        console.error('❌ API test failed:', err.message);
      } else {
        console.log('✅ API test successful! Connected to channel:', response.data.items[0]?.snippet?.title);
      }
    });
  });
} else {
  console.log('\n💡 Pro tip: You can also run this with the code directly:');
  console.log('   node setup-youtube-token.js YOUR_AUTH_CODE');
}
