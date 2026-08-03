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
