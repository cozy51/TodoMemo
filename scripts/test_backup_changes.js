const fs = require("fs");
const vm = require("vm");

const context = { JSON, Map, Set, String };
vm.createContext(context);
vm.runInContext(fs.readFileSync("storage.js", "utf8"), context);

const count = vm.runInContext(`
  countChangesSinceBackup(
    [{ id: "task-1", title: "更新後" }, { id: "task-2", title: "追加" }],
    [],
    [],
    {
      tasks: [{ id: "task-1", title: "更新前" }, { id: "task-old", title: "削除" }],
      tags: [{ id: "tag-old", name: "削除" }],
      parentCases: []
    }
  )
`, context);

if (count !== 4) {
  throw new Error(`Expected 4 added, updated, or deleted records; received ${count}`);
}

const missingBackupCount = vm.runInContext(
  "countChangesSinceBackup([], [], [], null)",
  context
);
if (missingBackupCount !== null) {
  throw new Error("A missing backup must not be displayed as zero changes");
}

console.log("Backup-change count tests: OK");
