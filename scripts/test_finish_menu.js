const fs = require("fs");

// The circle on an active task card opens a menu, so a task can be finished
// as 完了, 中止 or アーカイブ from the start.
const source = fs.readFileSync("organizer.js", "utf8");

for (const file of ["organizer.html", "index.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const template = html.match(/<template id="activeTaskTemplate">([\s\S]*?)<\/template>/)?.[1] || "";
  for (const className of ["finish-complete-button", "finish-cancel-button", "finish-archive-button"]) {
    if (!template.includes(`class="${className}"`)) {
      throw new Error(`${file}: the active card's finish menu must offer .${className}`);
    }
  }
  if (!/class="action-menu finish-menu"[^>]*hidden/.test(template)) {
    throw new Error(`${file}: the finish menu must be an action-menu that starts hidden`);
  }
}

const attach = source.match(/function attachFinishMenu\(card, task\) \{[\s\S]*?\n\}/)?.[0] || "";
if (!attach) throw new Error("organizer.js must define attachFinishMenu");
if (!/finish-complete-button[\s\S]*?setCompleted\(task\.id, true\)/.test(attach)) {
  throw new Error("完了 in the finish menu must complete the task");
}
if (!/finish-cancel-button[\s\S]*?setFinishedStatus\(task\.id, "canceled"\)/.test(attach)) {
  throw new Error("中止 in the finish menu must cancel the task");
}
if (!/finish-archive-button[\s\S]*?setFinishedStatus\(task\.id, "archived"\)/.test(attach)) {
  throw new Error("アーカイブ in the finish menu must archive the task");
}
if (!/attachFinishMenu\(card, task\);/.test(source)) {
  throw new Error("Active cards must wire up the finish menu");
}

console.log("finish menu tests passed");
