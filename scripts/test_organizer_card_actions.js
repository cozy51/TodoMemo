const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

const activeTaskTemplate = html.match(
  /<template id="activeTaskTemplate">([\s\S]*?)<\/template>/
)?.[1] || "";
const activeLinksIndex = activeTaskTemplate.indexOf('class="card-links-section"');
const activeContentIndex = activeTaskTemplate.indexOf('class="card-content markdown-body"');
if (activeLinksIndex < 0 || activeContentIndex < activeLinksIndex) {
  throw new Error("Task-card content must be displayed after the related-links section");
}
if (!activeTaskTemplate.includes("📋 URLを取り込む")) {
  throw new Error("Task cards must provide a URL import button");
}
if (!source.includes("function attachTaskLinkPaste(card, task)")) {
  throw new Error("Task-card URL import must have a clipboard handler");
}

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
if (!parentGroupFunction.includes('taskLinks.className = "parent-task-item-links"')) {
  throw new Error("Parent-case task rows must render a related-links area");
}
if (!parentGroupFunction.includes(
  'createTaskLink(taskLink, "table-link parent-task-link")'
)) {
  throw new Error("Parent-case task rows must render related links as link buttons");
}
if (!parentGroupFunction.includes(
  'ideaButton.textContent = `💡 アイデアメモ ${parentCase.ideaMemos.length}件`'
)) {
  throw new Error("Parent cases must render a clearly labeled idea-memo count button");
}
if (!parentGroupFunction.includes(
  'ideaButton.dataset.state = parentCase.ideaMemos.length > 0 ? "has-memos" : "empty"'
)) {
  throw new Error("The idea-memo button must distinguish empty and non-empty states");
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
if (!html.includes('<ol id="parentIdeaDialogList"')) {
  throw new Error("Idea memos must use semantic ordered-list markup");
}
if (!source.includes('number.textContent = `💡 ${index + 1}`')) {
  throw new Error("Idea-memo rows must display a clear numbered marker");
}
if (source.includes('edit.textContent = "編集"')) {
  throw new Error("Idea-memo rows must not require an edit-mode button");
}
if (!source.includes('input.value = memo.text')) {
  throw new Error("Every idea-memo row must always render as an editable input");
}
if (source.includes('save.textContent = "保存"') || source.includes('cancel.textContent = "キャンセル"')) {
  throw new Error("Idea-memo editing must not require save or cancel buttons");
}
if (!source.includes('input.addEventListener("blur", persistOpenParentIdeaEdits)')) {
  throw new Error("Idea memos must auto-save when their edit field loses focus");
}
if (!source.includes("function persistOpenParentIdeaEdits()")) {
  throw new Error("Edited idea memos must be persisted automatically");
}
if (!source.includes('parentIdeaDialogList.addEventListener("click", deleteParentIdeaMemoFromEvent)')) {
  throw new Error("Idea-memo deletion must use stable event delegation across dialog rerenders");
}
if (!source.includes(
  'parentIdeaDialogList.addEventListener("pointerdown", deleteParentIdeaMemoFromEvent)'
)) {
  throw new Error("Idea-memo deletion must start before edit-field blur can replace the rows");
}
if (!source.includes('input.addEventListener("input", () => {')) {
  throw new Error("Idea-memo inputs must track pending edits");
}
if (!source.includes("parentCases = removeParentIdeaMemo(")) {
  throw new Error("Idea-memo deletion must update the current parent-case collection immutably");
}
if (!source.includes("remove.dataset.memoId\n  );")) {
  throw new Error("Idea-memo deletion must use the stable memo id from the clicked row");
}
if (!source.includes("if (parentIdeaDialog.open) renderParentIdeaDialog();")) {
  throw new Error("The idea-memo dialog must refresh after storage replaces parent-case objects");
}
if (!source.includes("function queueParentIdeaSave(message)")) {
  throw new Error("Idea-memo writes must be serialized to prevent stale saves restoring deletions");
}
if (!source.includes("const snapshot = parentCases.map")) {
  throw new Error("Each queued idea-memo save must persist an immutable snapshot");
}
if (!source.includes("applyOpenParentIdeaEdits();")) {
  throw new Error("Idea-memo deletion must retain other pending edits before saving");
}
if (!css.includes(".parent-idea-dialog-list li + li")) {
  throw new Error("Idea-memo rows must be separated by rules");
}
if (source.includes('ideas.className = "parent-idea-memos"') || css.includes(".parent-idea-memos")) {
  throw new Error("The retired inline idea-memo editor must be removed, not merely hidden");
}
if (!source.includes("function removeRetiredInlineIdeaMemoEditors")) {
  throw new Error("Legacy inline idea-memo elements must be removed from the DOM");
}
if (!source.includes('element.remove()')) {
  throw new Error("Legacy inline idea-memo cleanup must delete elements rather than hide them");
}
if (!css.includes('.parent-task-group-idea-button[data-state="empty"]')) {
  throw new Error("Empty idea-memo buttons must have a distinct visual state");
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
