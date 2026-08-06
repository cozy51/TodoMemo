const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

for (const id of ["parentCaseJumpSelect", "taskJumpSelect"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`${id} is missing`);
  if (!source.includes(`${id}.addEventListener("change"`)) {
    throw new Error(`${id} must navigate as soon as its selection changes`);
  }
}

for (const placeholder of [
  "親案件コード・親案件名から選択",
  "案件コード・案件名から選択"
]) {
  if (!html.includes(`<option value="" selected disabled hidden>${placeholder}</option>`)) {
    throw new Error(`${placeholder} must be a hidden, non-selectable placeholder`);
  }
}
if (!source.includes("parentPlaceholder.disabled = true")
  || !source.includes("parentPlaceholder.hidden = true")
  || !source.includes("taskPlaceholder.disabled = true")
  || !source.includes("taskPlaceholder.hidden = true")) {
  throw new Error("Rendered jump placeholders must not appear as selectable list data");
}

if (!source.includes("function renderCaseJumpOptions(activeTasks)")) {
  throw new Error("Jump options must be refreshed with rendered task data");
}
if (!source.includes("`${parentCase.caseNumber}｜${parentCase.name}`")) {
  throw new Error("Parent-case options must contain their code and name");
}
if (!source.includes("`${task.caseNumber}｜${task.title}`")) {
  throw new Error("Task options must contain their code and name");
}
if (!source.includes("sortTasksByCaseNumberDescending(activeTasks).map")) {
  throw new Error("Task jump options must be sorted by case number descending");
}
if (!source.includes("setActiveListCollapsed(false)")) {
  throw new Error("Task navigation must reveal the active task list");
}
if (!source.includes('setParentCaseViewMode("group")')) {
  throw new Error("Parent-case navigation must reveal the grouped parent-case view");
}
if (!css.includes(".case-jump-panel")) {
  throw new Error("The case jump controls must have dedicated layout styling");
}

console.log("case jump checks passed");
