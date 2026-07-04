import { loadSkill } from "./loader";
import { extractPrompt } from "./parser";

export function buildSystemPrompt(
  baseSystem: string,
  skillName: string
) {
  const raw = loadSkill(skillName);
  const prompt = extractPrompt(raw);

  return `${prompt}

${baseSystem}`;
}
