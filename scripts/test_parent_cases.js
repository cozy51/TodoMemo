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

const firstLetter = run(`
  generateParentCaseNumber(
    "123456789".split("").map((suffix) => ({ caseNumber: "TD26-07P" + suffix })),
    new Date(2026, 6, 25)
  )
`);
if (firstLetter !== "TD26-07PA") {
  throw new Error(`Expected TD26-07PA after 9, received ${firstLetter}`);
}

const skippedLetters = run(`
  generateParentCaseNumber(
    [..."123456789ABCDEFGH"].map((suffix) => ({ caseNumber: "TD26-07P" + suffix })),
    new Date(2026, 6, 25)
  )
`);
if (skippedLetters !== "TD26-07PJ") {
  throw new Error(`Expected I to be skipped, received ${skippedLetters}`);
}

const skippedLetterO = run(`
  generateParentCaseNumber(
    [..."123456789ABCDEFGHJKLMN"].map((suffix) => ({ caseNumber: "TD26-07P" + suffix })),
    new Date(2026, 6, 25)
  )
`);
if (skippedLetterO !== "TD26-07PP") {
  throw new Error(`Expected O to be skipped, received ${skippedLetterO}`);
}

const exhausted = run(`
  (() => {
    try {
      generateParentCaseNumber(
        [..."123456789ABCDEFGHJKLMNPQRSTUVWXYZ"].map((suffix) => ({
          caseNumber: "TD26-07P" + suffix
        })),
        new Date(2026, 6, 25)
      );
      return false;
    } catch (error) {
      return error instanceof RangeError;
    }
  })()
`);
if (!exhausted) {
  throw new Error("Expected exhausted parent-case suffixes to throw RangeError");
}

const legacyMultiDigit = run(`
  assignParentCaseNumbers([
    { caseNumber: "TD26-07P10", createdAt: "2026-07-01T00:00:00Z" }
  ])[0].caseNumber
`);
if (legacyMultiDigit !== "TD26-07P1") {
  throw new Error(`Expected legacy multi-digit number to be reassigned, received ${legacyMultiDigit}`);
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
