const fs = require("fs");

const source = fs.readFileSync("organizer.js", "utf8");
const css = fs.readFileSync("organizer.css", "utf8");

if (!source.includes("function showDeadlineTooltip(anchor, dayTasks)")
  || !source.includes("function hideDeadlineTooltip()")
  || !source.includes("function fillDeadlineTooltip(tooltip, dayTasks)")) {
  throw new Error("The deadline calendar must build a custom hover tooltip");
}
if (!/day\.addEventListener\("mouseenter", \(\) => showDeadlineTooltip\(day, dayTasks\)\)/.test(source)
  || !source.includes('day.addEventListener("mouseleave", hideDeadlineTooltip)')) {
  throw new Error("Calendar days with a deadline must show the tooltip on hover");
}
if (!source.includes('day.addEventListener("focus", () => showDeadlineTooltip(day, dayTasks))')
  || !source.includes('day.addEventListener("blur", hideDeadlineTooltip)')) {
  throw new Error("The deadline tooltip must also be reachable by keyboard focus");
}
if (!source.includes("hideDeadlineTooltip();")
  || !/function renderDeadlineCalendar\(activeTasks\) \{\s*hideDeadlineTooltip\(\);/.test(source)) {
  throw new Error("Re-rendering the calendar must close any open tooltip");
}
if (!source.includes('window.addEventListener("scroll", hideDeadlineTooltip, true)')
  || !source.includes('window.addEventListener("resize", hideDeadlineTooltip)')) {
  throw new Error("The tooltip must close on scroll or resize so it never floats over the wrong date");
}

if (!css.includes(".deadline-tooltip {") || !css.includes("background: #263149")) {
  throw new Error("The deadline tooltip must use the app's dark surface color");
}
if (!/\.deadline-tooltip\s*\{[^}]*color:\s*#f3f5fb/.test(css)) {
  throw new Error("The deadline tooltip must use light text on its dark background");
}
if (!/\.deadline-tooltip\s*\{[^}]*font-size:\s*15px/.test(css)) {
  throw new Error("The deadline tooltip must use an enlarged, readable font size");
}
if (!css.includes(".deadline-tooltip-title") || !css.includes(".deadline-tooltip-case")) {
  throw new Error("The tooltip must clearly separate the case number from the task title");
}

console.log("Deadline-tooltip tests: OK");
