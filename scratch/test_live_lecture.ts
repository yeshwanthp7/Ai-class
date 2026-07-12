
async function testLecture() {
  const payload = {
    question: "Please give a detailed lecture explanation for the current topic to the class: Supervised Learning",
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

  console.log("Sending payload:", JSON.stringify(payload, null, 2));

  try {
    const res = await fetch("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("\n====== RAW NVIDIA RESPONSE ======\n");
      console.log(data.answer);
      console.log("\n=================================\n");
    } else {
      console.error("API error", res.status, await res.text());
    }
  } catch (e) {
    console.error("Fetch failed", e);
  }
}
testLecture();
