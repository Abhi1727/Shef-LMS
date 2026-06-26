const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/Shef-LMS/backend/.env' });

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key loaded:', apiKey ? apiKey.substring(0, 10) + '...' : 'NONE');

async function testGemini() {
  try {
    const prompt = `Generate exactly 5 quiz questions based on this topic: "Deep Learning, Neural Networks, Backpropagation".
Target difficulty: medium.
You MUST generate a mix of question types (mcq, true-false, fill-blank, coding).
Ensure all mcq and true-false questions have non-empty options array.
The response must be a JSON array matching the required JSON schema.`;

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING", enum: ["mcq", "true-false", "fill-blank", "coding"] },
                questionText: { type: "STRING" },
                options: { type: "ARRAY", items: { type: "STRING" } },
                correctAnswer: { type: "STRING" },
                explanation: { type: "STRING" },
                difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
                topic: { type: "STRING" }
              },
              required: ["type", "questionText", "correctAnswer", "difficulty"]
            }
          }
        }
      }
    );

    console.log('Gemini Status:', geminiRes.status);
    console.log('Gemini Output:', JSON.stringify(geminiRes.data, null, 2));
  } catch (err) {
    console.error('Gemini Error:', err.response ? err.response.data : err.message);
  }
}

testGemini();
