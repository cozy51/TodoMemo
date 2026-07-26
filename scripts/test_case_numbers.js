const fs = require("fs");
const vm = require("vm");

const context = {
  crypto: { randomUUID: () => "test-uuid" },
  URL,
  Date,
  Intl,
  Set,
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

const julyGap = run(`
  generateCaseNumber(
    [{ caseNumber: "TD26-0701" }, { caseNumber: "TD26-0703" }],
    new Date(2026, 6, 25)
  )
`);
if (julyGap !== "TD26-0702") {
  throw new Error(`Expected TD26-0702, received ${julyGap}`);
}

const nextMonth = run(`
  generateCaseNumber(
    [{ caseNumber: "TD26-0701" }],
    new Date(2026, 7, 1)
  )
`);
if (nextMonth !== "TD26-0801") {
  throw new Error(`Expected TD26-0801, received ${nextMonth}`);
}

const afterNinetyNine = run(`
  generateCaseNumber(
    Array.from({ length: 99 }, (_, index) => ({
      caseNumber: \`TD26-07\${String(index + 1).padStart(2, "0")}\`
    })),
    new Date(2026, 6, 25)
  )
`);
if (afterNinetyNine !== "TD26-07100") {
  throw new Error(`Expected TD26-07100, received ${afterNinetyNine}`);
}

const migrated = run(`
  assignCaseNumbers([
    { caseNumber: "", createdAt: "2026-07-01T00:00:00Z" },
    { caseNumber: "TD26-0701", createdAt: "2026-07-02T00:00:00Z" },
    { caseNumber: "TD26-0701", createdAt: "2026-07-03T00:00:00Z" }
  ]).map((task) => task.caseNumber)
`);
const expectedMigration = ["TD26-0702", "TD26-0701", "TD26-0703"];
if (JSON.stringify(migrated) !== JSON.stringify(expectedMigration)) {
  throw new Error(`Unexpected migration result: ${JSON.stringify(migrated)}`);
}

console.log("Case-number tests: OK");
