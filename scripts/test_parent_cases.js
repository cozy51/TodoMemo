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

function run(source) {
  return vm.runInContext(source, context);
}

const first = run(`
  generateParentCaseNumber([], new Date(2026, 6, 25))
`);
if (first !== "TD26-07P1") {
  throw new Error(`Expected TD26-07P1, received ${first}`);
}

const gap = run(`
  generateParentCaseNumber(
    [{ caseNumber: "TD26-07P1" }, { caseNumber: "TD26-07P3" }],
    new Date(2026, 6, 25)
  )
`);
if (gap !== "TD26-07P2") {
  throw new Error(`Expected TD26-07P2, received ${gap}`);
}

const nextMonth = run(`
  generateParentCaseNumber(
    [{ caseNumber: "TD26-07P1" }],
    new Date(2026, 7, 1)
  )
`);
if (nextMonth !== "TD26-08P1") {
  throw new Error(`Expected TD26-08P1, received ${nextMonth}`);
}

const migrated = run(`
  assignParentCaseNumbers([
    { caseNumber: "", createdAt: "2026-07-01T00:00:00Z" },
    { caseNumber: "TD26-07P1", createdAt: "2026-07-02T00:00:00Z" },
    { caseNumber: "TD26-07P1", createdAt: "2026-07-03T00:00:00Z" }
  ]).map((parentCase) => parentCase.caseNumber)
`);
const expectedMigration = ["TD26-07P2", "TD26-07P1", "TD26-07P3"];
if (JSON.stringify(migrated) !== JSON.stringify(expectedMigration)) {
  throw new Error(`Unexpected migration result: ${JSON.stringify(migrated)}`);
}

const normalizedUrl = run(`normalizeParentCaseUrl("https://example.com/project")`);
if (normalizedUrl !== "https://example.com/project") {
  throw new Error(`Unexpected normalized parent URL: ${normalizedUrl}`);
}

const rejectedUrl = run(`normalizeParentCaseUrl("mailto:test@example.com")`);
if (rejectedUrl !== "") {
  throw new Error(`Expected mailto URL to be rejected, received ${rejectedUrl}`);
}

const parentCaseId = run(`normalizeTask({ parentCaseId: "parent-1" }, 0).parentCaseId`);
if (parentCaseId !== "parent-1") {
  throw new Error(`Expected parentCaseId to be retained, received ${parentCaseId}`);
}

const groupedCounts = run(`
  groupTasksByParentCase(
    [{ id: "parent-1" }, { id: "parent-2" }],
    [
      { id: "task-1", parentCaseId: "parent-1" },
      { id: "task-2", parentCaseId: "" },
      { id: "task-3", parentCaseId: "missing-parent" }
    ]
  ).map((group) => group.tasks.length)
`);
if (JSON.stringify(groupedCounts) !== JSON.stringify([1, 0, 2])) {
  throw new Error(`Unexpected parent grouping result: ${JSON.stringify(groupedCounts)}`);
}

console.log("Parent-case tests: OK");
