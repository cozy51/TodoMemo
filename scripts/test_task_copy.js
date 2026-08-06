const fs = require("fs");
const vm = require("vm");

const context = {
  crypto: { randomUUID: () => "test-uuid" },
  URL,
  Date,
  Intl,
  Set,
  Map,
  Number,
  String,
  Boolean,
  Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("storage.js", "utf8"), context);

const copied = vm.runInContext(`
  formatTaskForCopy({
    caseNumber: "TD26-0701",
    title: "企画書を作る",
    content: "構成を確認\\r\\n初稿を作成"
  })
`, context);
const expected = "TD26-0701_企画書を作る [\n構成を確認\n初稿を作成\n]\n";

if (copied !== expected) {
  throw new Error(`Unexpected copy format: ${JSON.stringify(copied)}`);
}

const copiedWithoutContent = vm.runInContext(`
  formatTaskForCopy({
    caseNumber: "TD26-0702",
    title: "本文なし",
    content: ""
  })
`, context);
if (copiedWithoutContent !== "TD26-0702_本文なし [\n\n]\n") {
  throw new Error(`Unexpected empty-content format: ${JSON.stringify(copiedWithoutContent)}`);
}

const copiedHeading = vm.runInContext(`
  formatTaskHeadingForCopy({ caseNumber: "TD26-0701", title: "企画書を作る", content: "コピーしない内容" })
`, context);
if (copiedHeading !== "TD26-0701_企画書を作る") {
  throw new Error(`Unexpected heading-only copy format: ${JSON.stringify(copiedHeading)}`);
}

const copiedTasks = vm.runInContext(`
  formatTasksForCopy([
    {
      caseNumber: "TD26-0701",
      title: "企画書を作る",
      content: "構成を確認\\n初稿を作成"
    },
    {
      caseNumber: "TD26-0702",
      title: "図面を確認",
      content: "寸法を確認"
    }
  ])
`, context);
const expectedTasks =
  "TD26-0701 企画書を作る [\n" +
  "構成を確認\n" +
  "初稿を作成\n" +
  "]\n\n" +
  "TD26-0702 図面を確認 [\n" +
  "寸法を確認\n" +
  "]\n";
if (copiedTasks !== expectedTasks) {
  throw new Error(`Unexpected multi-task format: ${JSON.stringify(copiedTasks)}`);
}

const copiedEmptyTasks = vm.runInContext("formatTasksForCopy([])", context);
if (copiedEmptyTasks !== "") {
  throw new Error(`Unexpected empty task-list format: ${JSON.stringify(copiedEmptyTasks)}`);
}

const copiedParentCase = vm.runInContext(`
  formatParentCaseForCopy({ caseNumber: "TD26-07P6", name: "DX推進" })
`, context);
if (copiedParentCase !== "DX推進_TD26-07P6") {
  throw new Error(`Unexpected parent-case copy format: ${JSON.stringify(copiedParentCase)}`);
}

const contentLineCounts = vm.runInContext(`[
  countContentLines(""),
  countContentLines("1行"),
  countContentLines("1行\\n2行\\n3行"),
  countContentLines("1行\\r\\n2行\\r\\n")
]`, context);
if (JSON.stringify([...contentLineCounts]) !== JSON.stringify([0, 1, 3, 2])) {
  throw new Error(`Unexpected content line counts: ${JSON.stringify(contentLineCounts)}`);
}

console.log("Task-copy format test: OK");
