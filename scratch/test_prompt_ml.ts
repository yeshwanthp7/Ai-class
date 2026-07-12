import { getSystemPrompt } from "../src/lib/teacher/config";
import { classroomContext } from "../src/lib/classroom-context";

classroomContext.updateState({
  subject: "Machine Learning",
  topic: "Supervised Learning"
});

console.log("SYNCHRONIZED CONTEXT:", classroomContext.getState());
console.log("FINAL PROMPT:\n" + getSystemPrompt("intermediate"));
