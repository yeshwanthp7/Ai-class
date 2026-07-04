export function extractPrompt(skill: string): string {
  const split = skill.split("---");

  if (split.length < 3) {
    return skill;
  }

  return split.slice(2).join("---").trim();
}
