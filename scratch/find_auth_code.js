const fs = require("fs");
const path = require("path");

const transcriptPath = "C:\\Users\\YESHWANTH P\\.gemini\\antigravity\\brain\\0e4f22d3-5960-4104-849b-2382914825f7\\.system_generated\\logs\\transcript_full.jsonl";

function reconstruct() {
  const lines = fs.readFileSync(transcriptPath, "utf-8").split("\n");
  const fileLines = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const text = obj.content || "";
      if (text.includes("Showing lines") && text.includes("auth/page.tsx") && obj.step_index < 600) {
        const matchLines = text.split("\n");
        for (const ml of matchLines) {
          const trimMl = ml.trim();
          const match = /^(\d+): (.*)/.exec(trimMl);
          if (match) {
            const lineNum = parseInt(match[1]);
            const lineContent = match[2];
            fileLines[lineNum] = lineContent;
          } else {
            const matchEmpty = /^(\d+):$/.exec(trimMl);
            if (matchEmpty) {
              const lineNum = parseInt(matchEmpty[1]);
              fileLines[lineNum] = "";
            }
          }
        }
      }
    } catch (e) {}
  }

  const sortedKeys = Object.keys(fileLines).map(Number).sort((a,b) => a-b);
  console.log(`Reconstructed ${sortedKeys.length} lines!`);
  let fullCode = "";
  for (const k of sortedKeys) {
    fullCode += fileLines[k] + "\n";
  }

  fs.writeFileSync("C:\\Users\\YESHWANTH P\\.gemini\\antigravity\\brain\\0e4f22d3-5960-4104-849b-2382914825f7\\scratch\\reconstructed_auth.tsx", fullCode);
  console.log("Written to reconstructed_auth.tsx");
}

reconstruct();
