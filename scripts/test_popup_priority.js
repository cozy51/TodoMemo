const fs = require("fs");

const source = fs.readFileSync("popup.js", "utf8");
const html = fs.readFileSync("popup.html", "utf8");

if (!html.includes('<select id="editPrioritySelect"></select>')) {
  throw new Error("The popup task editor must provide a priority selector");
}

const priorityFieldIndex = html.indexOf('id="editPrioritySelect"');
if (
  priorityFieldIndex < html.indexOf('id="editParentCaseSelect"')
  || priorityFieldIndex > html.indexOf('id="editDueDateInput"')
) {
  throw new Error("The priority selector must appear between parent case and due date");
}

if (!source.includes("function renderPriorityOptions(task = null)")) {
  throw new Error("The popup must build priority options for new and existing tasks");
}
if (!source.includes("renderPriorityOptions(currentTask);")) {
  throw new Error("Existing-task editing must select the task's current priority");
}
if (!source.includes("allTasks = moveActiveTaskToPriority(")) {
  throw new Error("Saving from the popup must apply the selected priority");
}
if (!source.includes('editPrioritySelect.addEventListener("change", markEditorDirty)')) {
  throw new Error("Priority changes must trigger popup auto-save");
}

console.log("Popup priority tests: OK");
