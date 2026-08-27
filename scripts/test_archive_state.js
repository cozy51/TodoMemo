const fs = require("fs");
const vm = require("vm");

const context = { JSON, Map, Set, String, Number, Boolean, Array, Date, crypto };
vm.createContext(context);
vm.runInContext(fs.readFileSync("storage.js", "utf8"), context);

// An archived task is finished work that is kept on purpose, so it must always
// stay completed: anything that only knows about `completed` — the popup, an
// older release reading the same data — would otherwise show it as a to-do.
const archived = vm.runInContext(`
  normalizeTask({ id: "task-1", title: "資料あり", archived: true, completed: false }, 0)
`, context);
if (archived.completed !== true) {
  throw new Error("An archived task must also count as completed");
}
if (archived.archived !== true) {
  throw new Error("normalizeTask must keep the archived flag");
}

const dated = vm.runInContext(`
  normalizeTask({
    id: "task-2", title: "完了済み", archived: true, completedAt: "2026-08-01T00:00:00.000Z"
  }, 0)
`, context);
if (dated.archivedAt !== "2026-08-01T00:00:00.000Z") {
  throw new Error("A task archived without its own stamp must fall back to the completion time");
}

const plain = vm.runInContext(`normalizeTask({ id: "task-3", title: "すること" }, 0)`, context);
if (plain.archived !== false || plain.archivedAt !== null) {
  throw new Error("Tasks without archive data must be normalised to a non-archived state");
}

const unarchived = vm.runInContext(`
  normalizeTask({ id: "task-4", title: "戻した", archived: false, archivedAt: "2026-08-01T00:00:00.000Z" }, 0)
`, context);
if (unarchived.archivedAt !== null) {
  throw new Error("A task taken out of the archive must not keep its archive time");
}

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

if (html !== fs.readFileSync("index.html", "utf8")) {
  throw new Error("index.html and organizer.html must stay identical");
}

if (!html.includes('id="archivedSection"')
  || !html.includes('id="archivedList"')
  || !html.includes('id="archivedCount"')
  || !html.includes('id="archivedEmpty"')) {
  throw new Error("The organizer must provide an archive section of its own");
}
if (!html.includes('href="#archivedSection"') || !html.includes('id="navArchivedCount"')) {
  throw new Error("The page-jump navigation must link to the archive with its count");
}
if (!html.includes('<template id="archivedTaskTemplate">')) {
  throw new Error("Archived tasks need their own card template");
}

const activeTaskTemplate = html.match(
  /<template id="activeTaskTemplate">([\s\S]*?)<\/template>/
)?.[1] || "";
const completedTaskTemplate = html.match(
  /<template id="completedTaskTemplate">([\s\S]*?)<\/template>/
)?.[1] || "";
const archivedTaskTemplate = html.match(
  /<template id="archivedTaskTemplate">([\s\S]*?)<\/template>/
)?.[1] || "";

if (!activeTaskTemplate.includes('class="archive-button"')) {
  throw new Error("Active cards must offer a move-to-archive action");
}
if (!completedTaskTemplate.includes('class="status-radio-completed"')
  || !completedTaskTemplate.includes('class="status-radio-archived"')) {
  throw new Error("Completed cards must offer a 完了/アーカイブ radio toggle");
}
if (!archivedTaskTemplate.includes('class="status-radio-completed"')
  || !archivedTaskTemplate.includes('class="status-radio-archived"')
  || !archivedTaskTemplate.includes('class="restore-button"')
  || !archivedTaskTemplate.includes('class="delete-button')) {
  throw new Error("Archived cards must be able to switch back to completed via the radio toggle, go back to active, or be deleted");
}
if (!archivedTaskTemplate.includes('class="card-archived-at"')
  || !archivedTaskTemplate.includes('class="card-completed-at"')) {
  throw new Error("Archived cards must show when the task was completed and archived");
}
if (!archivedTaskTemplate.includes('class="card-links-section"')) {
  throw new Error("Archived cards must keep the related links that they exist to preserve");
}

if (!source.includes("function getArchivedTasks()")
  || !source.includes("function createArchivedCard(task)")
  || !source.includes("async function setArchived(taskId, archived)")) {
  throw new Error("organizer.js must implement the archived task state");
}
if (!source.includes("function attachStatusToggle(card, task, currentStatus)")) {
  throw new Error("organizer.js must wire up the 完了/アーカイブ radio toggle");
}
if (!/function getCompletedTasks\(\)[\s\S]*?task\.completed && !task\.archived/.test(source)) {
  throw new Error("Archived tasks must be kept out of the completed list");
}
if (!/function getActiveTasks\(\)[\s\S]*?!task\.completed && !task\.archived/.test(source)) {
  throw new Error("Archived tasks must be kept out of the active list");
}
if (!/async function setCompleted\(taskId, completed\)[\s\S]*?target\.archived = false/.test(source)) {
  throw new Error("Sending a task back to the active list must take it out of the archive");
}
if (!source.includes("archivedList.replaceChildren(...archived.map(createArchivedCard))")
  || !source.includes("navArchivedCount.textContent")
  || !source.includes("archivedCount.textContent")) {
  throw new Error("render() must fill the archive section and its counts");
}
if (!/function clearCompleted\(\)[\s\S]*?アーカイブへ移動したタスクは削除されません/.test(source)) {
  throw new Error("The bulk delete confirmation must state that archived tasks are kept");
}
if (!source.includes("function getArchivedTaskAnchorId(task)")
  || !/function getTaskAnchorHref\(task\)[\s\S]*?task\.archived/.test(source)) {
  throw new Error("Jump links must point at archived cards in the archive section");
}

if (!css.includes(".archived-card") || !css.includes(".card-archived-at")) {
  throw new Error("Archived cards need styles that set them apart from completed ones");
}
if (!css.includes(".task-card:not(.completed-card):not(.archived-card)")) {
  throw new Error("Archived cards must not use the active-card column layout");
}

console.log("Archive-state tests: OK");
