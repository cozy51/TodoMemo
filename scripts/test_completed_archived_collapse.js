const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

if (!source.includes("let completedListCollapsed = true;")
  || !source.includes("let archivedListCollapsed = true;")) {
  throw new Error("Completed and archived lists must start collapsed, like the active list");
}

for (const id of [
  "toggleCompletedListButton", "completedCollapsedNotice", "completedCollapsedCount",
  "toggleArchivedListButton", "archivedCollapsedNotice", "archivedCollapsedCount"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`${id} is missing`);
}

if (!source.includes("function setCompletedListCollapsed(collapsed)")
  || !source.includes("function setArchivedListCollapsed(collapsed)")) {
  throw new Error("Completed and archived lists must have their own collapse toggles");
}

if (!source.includes("setCompletedListCollapsed(completedListCollapsed)")
  || !source.includes("setArchivedListCollapsed(archivedListCollapsed)")) {
  throw new Error("render() must reapply the completed/archived collapse state");
}

if (!source.includes('toggleCompletedListButton.addEventListener("click", () => {')
  || !source.includes('completedCollapsedNotice.addEventListener("click", () => {')
  || !source.includes('toggleArchivedListButton.addEventListener("click", () => {')
  || !source.includes('archivedCollapsedNotice.addEventListener("click", () => {')) {
  throw new Error("The completed/archived collapse toggles and notices must be clickable");
}

if (!css.includes("#completedList.is-collapsed > .task-card:not(:first-child)")
  || !css.includes("#archivedList.is-collapsed > .task-card:not(:first-child)")) {
  throw new Error("Collapsed completed/archived lists must hide every card but the first");
}

if (!source.includes('else if (status.key === "completed") setCompletedListCollapsed(false);')
  || !source.includes('else if (status.key === "archived") setArchivedListCollapsed(false);')) {
  throw new Error("Jumping to a completed/archived search result must reveal its list");
}

if (!source.includes('else if (event.target.closest(\'a[href^="#completed-task-"]\')) {')
  || !source.includes('else if (event.target.closest(\'a[href^="#archived-task-"]\')) {')) {
  throw new Error("Clicking any link into a completed/archived task must reveal its list");
}

console.log("Completed/archived collapse tests: OK");
