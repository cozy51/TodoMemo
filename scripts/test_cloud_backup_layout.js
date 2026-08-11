const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "organizer.css"), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

const actions = rule(".app-header-actions");
const cloudPanel = rule(".cloud-backup-panel");
const headerLead = rule(".app-header > :first-child");

if (!/flex-wrap:\s*wrap/.test(actions)) {
  throw new Error("Header actions must wrap instead of compressing the title area");
}
if (!/flex-basis:\s*100%/.test(cloudPanel)) {
  throw new Error("Cloud backup controls must occupy their own header row");
}
if (!/flex:\s*0 0 290px/.test(headerLead)) {
  throw new Error("Header title column must keep a readable width");
}

console.log("Cloud-backup layout tests: OK");
