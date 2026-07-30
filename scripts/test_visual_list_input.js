const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("markdown.js", "utf8"), context);

function evaluate(expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

const spaceEdit = evaluate('getVisualListSpaceEdit("  -", 3, 3)');
if (JSON.stringify(spaceEdit) !== JSON.stringify({ start: 2, end: 3, text: "• " })) {
  throw new Error(`Unexpected list shortcut edit: ${JSON.stringify(spaceEdit)}`);
}

const continueEdit = evaluate('getVisualListEnterEdit("• 項目", 4, 4)');
if (JSON.stringify(continueEdit) !== JSON.stringify({ start: 4, end: 4, text: "\n• " })) {
  throw new Error(`Unexpected list continuation edit: ${JSON.stringify(continueEdit)}`);
}

const finishEdit = evaluate('getVisualListEnterEdit("• ", 2, 2)');
if (JSON.stringify(finishEdit) !== JSON.stringify({ start: 0, end: 2, text: "" })) {
  throw new Error(`Unexpected list completion edit: ${JSON.stringify(finishEdit)}`);
}

console.log("Visual-list input tests: OK");
