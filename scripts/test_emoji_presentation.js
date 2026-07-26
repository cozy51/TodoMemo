const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("markdown.js", "utf8"), context);

const cases = [
  ["☑", "☑️"],
  ["✈ 出張", "✈️ 出張"],
  ["☎連絡", "☎️連絡"],
  ["☑️ 指定済み", "☑️ 指定済み"],
  ["☑︎ 文字表示", "☑︎ 文字表示"],
  ["😀 標準絵文字", "😀 標準絵文字"],
  ["通常の文字 ABC 123", "通常の文字 ABC 123"]
];

cases.forEach(([source, expected]) => {
  const actual = vm.runInContext(
    `ensureEmojiPresentation(${JSON.stringify(source)})`,
    context
  );
  if (actual !== expected) {
    throw new Error(
      `Unexpected emoji presentation for ${JSON.stringify(source)}: ${JSON.stringify(actual)}`
    );
  }
});

console.log("Emoji-presentation tests: OK");
