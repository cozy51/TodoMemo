const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "organizer.css"), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

const actions = rule(".app-header-actions");
const cloudPanel = rule(".cloud-sync-panel");
const headerLead = rule(".app-header > :first-child");

if (!/flex-wrap:\s*wrap/.test(actions)) {
  throw new Error("Header actions must wrap instead of compressing the title area");
}
if (!/flex-basis:\s*100%/.test(cloudPanel)) {
  throw new Error("Cloud sync controls must occupy their own header row");
}
if (!/flex:\s*0 0 290px/.test(headerLead)) {
  throw new Error("Header title column must keep a readable width");
}

// Every element the sync engine talks to has to exist on both entry points, or
// the status, conflict prompt, and history restore silently do nothing.
const requiredIds = [
  "cloudSyncStatus", "cloudSyncDetail", "cloudSyncEmail", "cloudSyncPassword",
  "cloudSyncSignIn", "cloudSyncSignOut", "cloudSyncNow", "cloudSyncHistory",
  "cloudSyncResolve", "cloudConflictDialog", "cloudConflictReason",
  "cloudConflictRemoteSummary", "cloudConflictLocalSummary", "cloudConflictUseRemote",
  "cloudConflictUseLocal", "cloudConflictLater", "cloudHistoryDialog",
  "cloudHistoryList", "cloudHistoryEmpty", "cloudHistoryClose",
  // The restore dialog has to show both sides and gate a step backwards.
  "restoreCurrentUpdatedAt", "restoreCurrentTaskCount", "restoreCurrentTagCount",
  "restoreCurrentProjectCount", "restoreRegressionWarning",
  "restoreAcknowledgeRow", "restoreAcknowledge"
];

["index.html", "organizer.html"].forEach((page) => {
  const markup = fs.readFileSync(path.join(root, page), "utf8");
  requiredIds.forEach((id) => {
    if (!markup.includes(`id="${id}"`)) {
      throw new Error(`${page} is missing #${id}`);
    }
  });
  if (!markup.includes('<script src="cloud-sync.js"></script>')) {
    throw new Error(`${page} must load cloud-sync.js`);
  }
  if (markup.includes("supabase-backup.js")) {
    throw new Error(`${page} still references the replaced supabase-backup.js`);
  }
  if (markup.indexOf("cloud-sync.js") < markup.indexOf("organizer.js")
    && markup.indexOf("storage.js") > markup.indexOf("cloud-sync.js")) {
    throw new Error(`${page} must load storage.js before cloud-sync.js`);
  }
});

// Signed out means edits stay on this PC, so the page must look visibly different.
if (!/background:[^;]*#fff1e3/.test(rule("body.is-cloud-signed-out"))) {
  throw new Error("Signed-out pages must switch to the warm background");
}
const syncScript = fs.readFileSync(path.join(root, "cloud-sync.js"), "utf8");
if (!/classList\.toggle\("is-cloud-signed-out"/.test(syncScript)) {
  throw new Error("cloud-sync.js must toggle the signed-out body class");
}

console.log("Cloud-sync layout tests: OK");
