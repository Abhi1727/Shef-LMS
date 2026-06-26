const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/Shef-LMS/backend/.env' });

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    console.log('Available Models:', res.data.models.map(m => m.name));
  } catch (err) {
    console.error('List Models Error:', err.response ? err.response.data : err.message);
  }
}

listModels();
