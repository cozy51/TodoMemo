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

const descendingTaskNumbers = run(`
  sortTasksByCaseNumberDescending([
    { caseNumber: "TD26-0703" },
    { caseNumber: "TD26-0801" },
    { caseNumber: "TD26-0711" }
  ]).map((task) => task.caseNumber)
`);
if (JSON.stringify([...descendingTaskNumbers]) !== JSON.stringify([
  "TD26-0801", "TD26-0711", "TD26-0703"
])) {
  throw new Error(`Unexpected descending task order: ${JSON.stringify(descendingTaskNumbers)}`);
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
if (afterNinetyNine !== "TD26-07A0") {
  throw new Error(`Expected TD26-07A0, received ${afterNinetyNine}`);
}

const afterA9 = run(`
  generateCaseNumber(
    [
      ...Array.from({ length: 99 }, (_, index) => ({
        caseNumber: "TD26-07" + String(index + 1).padStart(2, "0")
      })),
      ...Array.from({ length: 10 }, (_, digit) => ({ caseNumber: "TD26-07A" + digit }))
    ],
    new Date(2026, 6, 25)
  )
`);
if (afterA9 !== "TD26-07B0") {
  throw new Error(`Expected TD26-07B0, received ${afterA9}`);
}

const allowedLetters = "ABCDEFGHJKLMNQRSTUVWXYZ";
for (const [previousLetter, expectedLetter] of [["H", "J"], ["N", "Q"]]) {
  const nextLetter = run(`
    generateCaseNumber(
      [
        ...Array.from({ length: 99 }, (_, index) => ({
          caseNumber: "TD26-07" + String(index + 1).padStart(2, "0")
        })),
        ...[..."${allowedLetters.slice(0, allowedLetters.indexOf(previousLetter) + 1)}"].flatMap((letter) =>
          Array.from({ length: 10 }, (_, digit) => ({ caseNumber: "TD26-07" + letter + digit }))
        )
      ],
      new Date(2026, 6, 25)
    )
  `);
  if (nextLetter !== `TD26-07${expectedLetter}0`) {
    throw new Error(`Expected ambiguous letters after ${previousLetter} to be skipped, received ${nextLetter}`);
  }
}

const legacyThreeDigits = run(`
  assignCaseNumbers([
    { caseNumber: "TD26-07100", createdAt: "2026-07-01T00:00:00Z" }
  ])[0].caseNumber
`);
if (legacyThreeDigits !== "TD26-0701") {
  throw new Error(`Expected legacy three-digit number to be reassigned, received ${legacyThreeDigits}`);
}

const exhausted = run(`
  (() => {
    try {
      generateCaseNumber(
        TODO_MEMO_CASE_SEQUENCE.map((suffix) => ({ caseNumber: "TD26-07" + suffix })),
        new Date(2026, 6, 25)
      );
      return false;
    } catch (error) {
      return error instanceof RangeError;
    }
  })()
`);
if (!exhausted) {
  throw new Error("Expected exhausted case-number suffixes to throw RangeError");
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

const currentMonthMatch = run(
  'isCaseNumberForMonth("TD26-0801", new Date(2026, 7, 3))'
);
const previousMonthMatch = run(
  'isCaseNumberForMonth("TD26-0701", new Date(2026, 7, 3))'
);
if (!currentMonthMatch || previousMonthMatch) {
  throw new Error("Case-number month detection did not preserve only the current month");
}

console.log("Case-number tests: OK");
