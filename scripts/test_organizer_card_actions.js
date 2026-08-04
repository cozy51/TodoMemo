const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");

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
if (!parentGroupFunction.includes(
  'ideaButton.textContent = `💡 アイデアメモ ${parentCase.ideaMemos.length}件`'
)) {
  throw new Error("Parent cases must render a clearly labeled idea-memo count button");
}
if (parentGroupFunction.includes('ideas.className = "parent-idea-memos"')) {
  throw new Error("Idea memos must remain hidden until the count button opens the dialog");
}
if (!source.includes("function openParentIdeaDialog(parentCaseId)")) {
  throw new Error("The idea-memo count button must open a dialog");
}
if (
  parentGroupFunction.includes('document.createElement("input")')
  || parentGroupFunction.includes('document.createElement("form")')
  || parentGroupFunction.includes('remove.textContent = "削除"')
) {
  throw new Error("The parent-case list must only expose the idea-memo popup button");
}
if (!html.includes('<dialog id="parentIdeaDialog"')) {
  throw new Error("The organizer must provide an idea-memo dialog");
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
