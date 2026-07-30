const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("markdown.js", "utf8"), context);

const cases = [
  ["Z908751501   SERVO", 0, 13, 10],
  ["Z908751501\tSERVO", 0, 11, 10],
  ["Z908751501　SERVO", 0, 11, 10],
  ["Z908751501\nSERVO", 0, 11, 11],
  ["Z908751501", 0, 10, 10]
];

cases.forEach(([value, start, end, expected]) => {
  const actual = vm.runInContext(
    `getSelectionEndWithoutTrailingSpacing(${JSON.stringify(value)}, ${start}, ${end})`,
    context
  );
  if (actual !== expected) {
    throw new Error(`Expected selection end ${expected}, received ${actual}`);
  }
});

console.log("Selection-highlight tests: OK");
