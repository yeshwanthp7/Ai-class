const http = require('http');

const payload = {
  question: "Please give a brief explanation of Supervised Learning.",
  target: "teacher",
  state: {
    sessionId: "TEST_SESSION",
    subject: "Machine Learning",
    module: "Introduction",
    topic: "Supervised Learning",
    lessonGoal: "Understand supervised learning",
    difficulty: "intermediate",
    studentLevel: "undergraduate",
    currentProgress: 0,
    previousTopics: [],
    conversationHistory: [],
    classroomStatus: "idle"
  }
};

const postData = JSON.stringify(payload);
const start = Date.now();

console.log("Sending POST request to http://localhost:3000/api/ai...");

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log(`Status code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let firstChunkReceived = false;

  res.on('data', (chunk) => {
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      const elapsed = Date.now() - start;
      console.log(`\n[SUCCESS] Time-to-First-Token (TTFT): ${elapsed}ms\n`);
    }
    process.stdout.write(chunk.toString());
  });

  res.on('end', () => {
    console.log(`\n\n[SUCCESS] Stream finished in ${Date.now() - start}ms`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
