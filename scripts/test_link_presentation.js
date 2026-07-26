const fs = require("fs");
const vm = require("vm");

const context = { URL };
vm.createContext(context);
vm.runInContext(fs.readFileSync("storage.js", "utf8"), context);

function presentation(url) {
  return vm.runInContext(
    `getTaskLinkPresentation(${JSON.stringify(url)})`,
    context
  );
}

[
  "https://loop.cloud.microsoft/p/example",
  "https://loop.microsoft.com/p/example",
  "https://www.microsoft365.com/launch/loop",
  "https://muratecmail.sharepoint.com/:fl:/r/contentstorage/CSP_2f14986c-e4c2-4d48-ae78-bbf2090ef557/Document%20Library/LoopAppData/example.fluid",
  "https://muratecmail.sharepoint.com/contentstorage/CSP_2f14986c-e4c2-4d48-ae78-bbf2090ef557/example.loop",
  "https://muratecmail.sharepoint.com/:fl:/g/contentstorage/CSP_2f14986c-e4c2-4d48-ae78-bbf2090ef557/IQAK7v3HFS0kSIOAtl6r0IUKASGXtbVrhWiqdSJ_qlE2fJU?e=1HBKo8&nav=cz0lMkZjb250ZW50c3RvcmFnZSUyRkNTUF8yZjE0OTg2Yy1lNGMyLTRkNDgtYWU3OC1iYmYyMDkwZWY1NTcmZD1iJTIxYkpnVUw4TGtTRTJ1ZUx2eUNRNzFWeFF3aTRQNlB6cER2U21HYlNieDFUOU41RWRSX09kTFJMNEZQdnhTdExkTSZmPTAxWFhZQ0JVQUs1MzY0T0ZKTkVSRUlIQUZXTDJWNUJCSUsmYz0lMkYmYT1Mb29wQXBwJnA9JTQwZmx1aWR4JTJGbG9vcC1wYWdlLWNvbnRhaW5lcg%3D%3D"
].forEach((url) => {
  const result = presentation(url);
  if (
    result.type !== "Microsoft Loop" ||
    result.label !== "Loop" ||
    result.iconAsset !== "assets/icons/microsoft-loop.svg"
  ) {
    throw new Error(`Loop URL was not recognized: ${url}`);
  }
});

const sharePoint = presentation("https://example.sharepoint.com/sites/project");
if (sharePoint.type === "Microsoft Loop") {
  throw new Error("A regular SharePoint URL was incorrectly recognized as Loop");
}

const googleDrive = presentation(
  "https://drive.google.com/drive/project/1_CEotndS_1qMTmINRJb7sitmYc8aYyWJ?usp=sharing"
);
if (
  googleDrive.type !== "Google Drive" ||
  googleDrive.label !== "Drive" ||
  googleDrive.iconAsset !== "assets/icons/google-drive.svg"
) {
  throw new Error("The Google Drive URL was not recognized");
}

const outlook = presentation(
  "https://outlook.cloud.microsoft/mail/deeplink/read/example?ItemID=example&exvsurl=1"
);
if (
  outlook.type !== "Microsoft Outlook" ||
  outlook.label !== "Outlook" ||
  outlook.iconAsset !== "assets/icons/microsoft-outlook.svg"
) {
  throw new Error("The Outlook URL was not recognized");
}

const geminiNotebook = presentation(
  "https://notebooklm.google.com/notebook/7c834f5c-5303-45a7-819a-5e47e8e29689"
);
if (
  geminiNotebook.type !== "Gemini Notebook" ||
  geminiNotebook.label !== "Notebook" ||
  geminiNotebook.iconAsset !== "assets/icons/gemini-notebook.svg"
) {
  throw new Error("The Gemini Notebook URL was not recognized");
}

console.log("Link-presentation tests: OK");
