const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");

if (source.includes("attachDoubleClickEdit")) {
  throw new Error("organizer.js still references the removed attachDoubleClickEdit helper");
}

const completedCardFunction = source.match(
  /function createCompletedCard\(task\) \{([\s\S]*?)\n\}/
);
if (!completedCardFunction?.[1].includes("attachCardOpenActions(card, task)")) {
  throw new Error("Completed task cards must use the defined card-open helper");
}

const parentGroupFunction = source.match(
  /function createParentCaseTaskGroup\(parentCase, groupedTasks, priorityByTaskId\) \{([\s\S]*?)\n\}/
)?.[1] || "";
if (!parentGroupFunction.includes('document.createElement(parentCase?.url ? "a" : "div")')) {
  throw new Error("A parent case with a URL must render its identity as a link");
}
if (!parentGroupFunction.includes('addTaskButton.textContent = "＋ タスク追加"')) {
  throw new Error("Parent-case task creation must use a dedicated button");
}
if (!parentGroupFunction.includes('ideaTitle.textContent = "アイデアメモ"')) {
  throw new Error("Parent cases must render the idea-memo list");
}

const renderFunction = source.match(/function render\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
const completedRenderIndex = renderFunction.indexOf("completedList.replaceChildren");
if (
  completedRenderIndex < 0
  || renderFunction.indexOf("renderDeadlineCalendar(active)") > completedRenderIndex
  || renderFunction.indexOf("renderCompactTaskTable(active)") > completedRenderIndex
) {
  throw new Error("Calendar and compact-list rendering must not depend on completed cards");
}

console.log("Organizer card-action tests: OK");
