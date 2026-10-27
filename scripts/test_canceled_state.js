const fs = require("fs");
const vm = require("vm");

const context = { JSON, Map, Set, String, Number, Boolean, Array, Date, crypto };
vm.createContext(context);
vm.runInContext(fs.readFileSync("storage.js", "utf8"), context);

// A canceled task was dropped without being done, but it is finished all the
// same: anything that only knows about `completed` must keep it off the to-do
// list.
const canceled = vm.runInContext(`
  normalizeTask({ id: "task-1", title: "取りやめ", canceled: true, completed: false }, 0)
`, context);
if (canceled.completed !== true || canceled.canceled !== true) {
  throw new Error("A canceled task must keep its flag and also count as completed");
}

const dated = vm.runInContext(`
  normalizeTask({
    id: "task-2", title: "取りやめ", canceled: true, completedAt: "2026-08-01T00:00:00.000Z"
  }, 0)
`, context);
if (dated.canceledAt !== "2026-08-01T00:00:00.000Z") {
  throw new Error("A task canceled without its own stamp must fall back to the completion time");
}

const plain = vm.runInContext(`normalizeTask({ id: "task-3", title: "すること" }, 0)`, context);
if (plain.canceled !== false || plain.canceledAt !== null) {
  throw new Error("Tasks without cancel data must be normalised to a non-canceled state");
}

const both = vm.runInContext(`
  normalizeTask({ id: "task-4", title: "両方", canceled: true, archived: true }, 0)
`, context);
if (both.archived !== true || both.canceled !== false || both.canceledAt !== null) {
  throw new Error("A task sits in one finished state only: archived wins over canceled");
}

const source = fs.readFileSync("organizer.js", "utf8");
const html = fs.readFileSync("organizer.html", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

if (html !== fs.readFileSync("index.html", "utf8")) {
  throw new Error("index.html and organizer.html must stay identical");
}

for (const id of [
  "canceledSection", "canceledList", "canceledCount", "canceledEmpty",
  "toggleCanceledListButton", "canceledCollapsedNotice", "canceledCollapsedCount",
  "navCanceledCount"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`${id} is missing`);
}
if (!html.includes('href="#canceledSection"')) {
  throw new Error("The page-jump navigation must link to the canceled section");
}
if (html.indexOf('id="completedSection"') > html.indexOf('id="canceledSection"')
  || html.indexOf('id="canceledSection"') > html.indexOf('id="archivedSection"')) {
  throw new Error("The canceled section must sit between Completed and Archived");
}

const template = (id) => html.match(
  new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`)
)?.[1] || "";
const activeTaskTemplate = template("activeTaskTemplate");
const canceledTaskTemplate = template("canceledTaskTemplate");

if (!activeTaskTemplate.includes('class="cancel-task-button"')) {
  throw new Error("Active cards must offer a cancel action besides completing");
}
for (const id of ["completedTaskTemplate", "canceledTaskTemplate", "archivedTaskTemplate"]) {
  const body = template(id);
  if (!body.includes('class="status-radio-completed"')
    || !body.includes('class="status-radio-canceled"')
    || !body.includes('class="status-radio-archived"')) {
    throw new Error(`${id} must offer the 完了/中止/アーカイブ radio toggle`);
  }
}
if (!canceledTaskTemplate.includes('class="card-canceled-at"')
  || !canceledTaskTemplate.includes('class="restore-button"')
  || !canceledTaskTemplate.includes('class="delete-button')
  || !canceledTaskTemplate.includes('class="card-links-section"')) {
  throw new Error("Canceled cards must show when they were canceled, keep links, and be restorable or deletable");
}

if (!source.includes("function getCanceledTasks()")
  || !source.includes("function createCanceledCard(task)")
  || !source.includes("function setCanceledListCollapsed(collapsed)")
  || !source.includes("let canceledListCollapsed = true;")) {
  throw new Error("organizer.js must implement the canceled task state");
}
if (!/function getCompletedTasks\(\)[\s\S]*?!task\.canceled/.test(source)) {
  throw new Error("Canceled tasks must be kept out of the completed list");
}
if (!/async function setCompleted\(taskId, completed\)[\s\S]*?target\.canceled = false/.test(source)) {
  throw new Error("Sending a task back to the active list must clear its canceled state");
}
if (!/async function setFinishedStatus\(taskId, status\)[\s\S]*?target\.canceled = status === "canceled"[\s\S]*?target\.archived = status === "archived"/.test(source)) {
  throw new Error("Switching the finished state must set canceled and archived exclusively");
}
if (!source.includes("canceledList.replaceChildren(...canceled.map(createCanceledCard))")
  || !source.includes("navCanceledCount.textContent")
  || !source.includes("canceledCount.textContent")
  || !source.includes("setCanceledListCollapsed(canceledListCollapsed)")) {
  throw new Error("render() must fill the canceled section and its counts");
}
if (!/function getTaskAnchorHref\(task\)[\s\S]*?task\.canceled/.test(source)
  || !source.includes('else if (status.key === "canceled") setCanceledListCollapsed(false);')
  || !source.includes('else if (event.target.closest(\'a[href^="#canceled-task-"]\')) {')) {
  throw new Error("Jump links and search results must reveal canceled cards");
}
if (!/function clearCompleted\(\)[\s\S]*?中止・アーカイブへ移動したタスクは削除されません/.test(source)) {
  throw new Error("The bulk delete confirmation must state that canceled tasks are kept");
}

if (!css.includes(".canceled-card") || !css.includes(".card-canceled-at")
  || !css.includes("#canceledList.is-collapsed > .task-card:not(:first-child)")
  || !css.includes(".task-card:not(.completed-card):not(.archived-card):not(.canceled-card)")) {
  throw new Error("Canceled cards need their own styles and collapse rule");
}

console.log("Canceled-state tests: OK");
