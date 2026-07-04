import fs from "fs";
import path from "path";

const ROOT = path.join(
  process.cwd(),
  "vendor",
  "ponytail",
  "skills"
);

export function loadSkill(name: string): string {
  const file = path.join(ROOT, name, "SKILL.md");

  if (!fs.existsSync(file)) {
    throw new Error(`Ponytail skill '${name}' not found.`);
  }

  return fs.readFileSync(file, "utf8");
}

export function listSkills(): string[] {
  return fs
    .readdirSync(ROOT)
    .filter(folder =>
      fs.existsSync(path.join(ROOT, folder, "SKILL.md"))
    );
}
