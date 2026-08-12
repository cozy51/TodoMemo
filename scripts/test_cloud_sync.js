const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = new Map();
const context = {
  JSON, Map, Set, String, Math, Number, Date, Array, Object, RegExp, Boolean,
  Intl, console, Promise,
  crypto: { randomUUID: () => `id-${store.size}-${Math.random().toString(36).slice(2)}` },
  navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0" },
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8"), context);

const {
  decideSyncAction, assessDatasetShrink, createDatasetFingerprint, normalizeDataset,
  loadTodoMemoSyncState, saveTodoMemoSyncState, countDatasetRecords, isDatasetEmpty,
  validateBackup, describeTodoMemoDevice, getTodoMemoDeviceId, selectExpiredHistory,
  assessRestoreRegression, getDatasetActivityAt, formatElapsedJa
} = context;

function check(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

// --- decideSyncAction ------------------------------------------------------
// The single rule that keeps an old copy from replacing newer work.

const base = {
  remoteExists: true,
  remoteLegacy: false,
  remoteRevision: 5,
  remoteFingerprint: "remote",
  baseRevision: 5,
  baseFingerprint: "base",
  localFingerprint: "base",
  localEmpty: false
};

check(
  decideSyncAction({ ...base, remoteExists: false, localFingerprint: "local" }),
  "push",
  "First device seeds the cloud"
);
check(
  decideSyncAction({
    ...base, localEmpty: true, localFingerprint: "empty",
    baseRevision: 0, baseFingerprint: ""
  }),
  "pull",
  "A new browser, or one whose site data was cleared, adopts the cloud"
);
check(
  decideSyncAction({ ...base, localEmpty: true, localFingerprint: "empty" }),
  "push",
  "Emptying a browser that has synced before is an edit, not a fresh install"
);
check(
  decideSyncAction({
    ...base, remoteExists: false, localEmpty: true, localFingerprint: "empty",
    baseRevision: 0, baseFingerprint: ""
  }),
  "idle",
  "A new browser with no cloud document has nothing to do"
);
check(
  decideSyncAction({ ...base, remoteExists: false, localEmpty: true, localFingerprint: "empty" }),
  "push",
  "Emptying a synced browser is published even before the cloud has a document"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9 }),
  "pull",
  "An untouched local copy follows a newer cloud revision"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9, localFingerprint: "local" }),
  "conflict",
  "Unsynced local edits must never overwrite a newer cloud revision"
);
check(
  decideSyncAction({ ...base, localFingerprint: "local" }),
  "push",
  "Local edits on the current revision are published"
);
check(
  decideSyncAction({ ...base, baseRevision: 9 }),
  "conflict",
  "A cloud revision older than the local base is treated as suspicious"
);
check(
  decideSyncAction({ ...base, remoteRevision: 9, remoteFingerprint: "base" }),
  "adopt",
  "Identical content only needs its revision lineage aligned"
);
check(
  decideSyncAction({ ...base, remoteFingerprint: "base" }),
  "idle",
  "Identical content on the same revision needs no transfer"
);
check(
  decideSyncAction({ ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0 }),
  "pull",
  "A pre-revision cloud file wins when nothing local is unsynced"
);
check(
  decideSyncAction({
    ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0, localFingerprint: "local"
  }),
  "conflict",
  "A pre-revision cloud file cannot be ordered, so the user decides"
);
check(
  decideSyncAction({ ...base, localFingerprint: "base", remoteFingerprint: "other" }),
  "pull",
  "The cloud stays authoritative when it changed in place"
);
check(
  decideSyncAction({
    ...base, remoteLegacy: true, remoteRevision: 0, baseRevision: 0, baseFingerprint: "",
    remoteFingerprint: "same", localFingerprint: "same"
  }),
  "push",
  "Upgrading a matching pre-revision file numbers it now, so later edits are not conflicts"
);

// --- assessDatasetShrink ---------------------------------------------------
// The mis-click / wiped-profile guard.

const remoteDataset = {
  tasks: Array.from({ length: 10 }, (_, index) => ({ id: `t${index}` })),
  tags: [], parentCases: [], holidays: []
};

check(
  assessDatasetShrink(remoteDataset, { tasks: [], tags: [], parentCases: [], holidays: [] })?.reason,
  "empty",
  "An empty local copy must never silently clear the cloud"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: remoteDataset.tasks.slice(0, 4) })?.reason,
  "shrink",
  "Losing more than half the records needs confirmation"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: remoteDataset.tasks.slice(0, 9) }),
  null,
  "Deleting a single task is ordinary editing"
);
check(
  assessDatasetShrink(remoteDataset, { tasks: [...remoteDataset.tasks, { id: "new" }] }),
  null,
  "Adding records is never a loss"
);
check(
  assessDatasetShrink({ tasks: [], tags: [], parentCases: [], holidays: [] }, { tasks: [] }),
  null,
  "An empty cloud has nothing to protect"
);
check(
  assessDatasetShrink({ tasks: [{ id: "a" }, { id: "b" }] }, { tasks: [] })?.reason,
  "empty",
  "Even a tiny cloud copy is protected from a full wipe"
);

// --- fingerprints ----------------------------------------------------------

const sample = {
  tasks: [{ id: "a", title: "一つ目" }, { id: "b", title: "二つ目" }],
  tags: [{ id: "tag", name: "社内" }],
  parentCases: [],
  holidays: [{ date: "2026-01-01", type: "company" }]
};
const sameSample = JSON.parse(JSON.stringify(sample));
check(
  createDatasetFingerprint(sample),
  createDatasetFingerprint(sameSample),
  "Equal data must fingerprint equally"
);
if (createDatasetFingerprint(sample) === createDatasetFingerprint({
  ...sample,
  tasks: [{ id: "a", title: "一つ目" }, { id: "b", title: "二つ目！" }]
})) {
  throw new Error("An edited title must change the fingerprint");
}
if (createDatasetFingerprint(sample) === createDatasetFingerprint({
  ...sample,
  tasks: [sample.tasks[1], sample.tasks[0]]
})) {
  throw new Error("Reordering tasks changes the priority order and must be synced");
}
check(countDatasetRecords(sample), 4, "Record count spans every collection");
check(isDatasetEmpty({ tasks: [], tags: [], parentCases: [], holidays: [] }), true, "Empty dataset");

// --- normalizeDataset ------------------------------------------------------

const normalized = normalizeDataset({
  tasks: [
    { id: "task-1", title: "残る", tagIds: ["tag-1", "missing"], parentCaseId: "gone" },
    { id: "task-2", title: "", tagIds: [] }
  ],
  tags: [{ id: "tag-1", name: "社内" }, { id: "tag-2", name: "   " }],
  parentCases: [{ id: "parent-1", name: "親案件" }],
  holidays: [{ date: "2026-05-05", type: "company" }, { date: "bad" }]
});
check(normalized.tags.length, 1, "Nameless tags are dropped");
check(normalized.tasks[0].tagIds.length, 1, "Tag references to deleted tags are dropped");
check(normalized.tasks[0].parentCaseId, "", "Dangling parent references are cleared");
check(normalized.holidays.length, 1, "Invalid holidays are dropped");
check(normalized.parentCases[0].caseNumber.includes("P"), true, "Parent case numbers are assigned");
check(
  createDatasetFingerprint(normalizeDataset(normalized)),
  createDatasetFingerprint(normalized),
  "Normalization is stable, so a synced copy does not keep re-uploading itself"
);

// --- sync state ------------------------------------------------------------

saveTodoMemoSyncState({
  userId: "user-a", revision: 7, fingerprint: "abc",
  remoteUpdatedAt: "2026-08-12T00:00:00.000Z", lastSyncedAt: "2026-08-12T00:00:00.000Z"
});
check(loadTodoMemoSyncState("user-a").revision, 7, "Sync state round-trips");
check(
  loadTodoMemoSyncState("user-b").revision,
  0,
  "Another account's revision history must not be inherited"
);
check(
  store.has("todoMemoTasks"),
  false,
  "Sync bookkeeping must not be written into the synced collections"
);

// --- restoring a file must not walk the data backwards ----------------------
// Restoring is the one manual action that can overwrite newer data with older,
// so it is judged on age, not only on how many records would disappear.

const task = (id, createdAt) => ({ id, title: id, createdAt, completed: false });
const currentDataset = {
  tasks: [task("a", "2026-08-12T21:01:00.000Z"), task("b", "2026-08-12T20:00:00.000Z")],
  tags: [], parentCases: [], holidays: []
};

const stale = assessRestoreRegression({
  backupExportedAt: "2026-08-12T18:00:00.000Z",
  backupDataset: { tasks: [task("a", "2026-08-12T17:00:00.000Z")] },
  currentUpdatedAt: "2026-08-12T21:02:00.000Z",
  currentDataset
});
check(stale.level, "danger", "A backup older than the current data is a step backwards");
check(stale.staleMs, 3 * 3600000 + 2 * 60000, "The gap that would be lost is measured");

// The same file with no counts lost is still a step backwards.
check(
  assessRestoreRegression({
    backupExportedAt: "2026-08-12T18:00:00.000Z",
    backupDataset: { tasks: [task("a", "x"), task("b", "y"), task("c", "z")] },
    currentUpdatedAt: "2026-08-12T21:02:00.000Z",
    currentDataset
  }).level,
  "danger",
  "Age alone triggers the warning, even when the backup holds more records"
);

check(
  assessRestoreRegression({
    backupExportedAt: "2026-08-13T09:00:00.000Z",
    backupDataset: { tasks: [task("a", "2026-08-13T09:00:00.000Z")] },
    currentUpdatedAt: "2026-08-12T21:02:00.000Z",
    currentDataset: { tasks: [task("a", "2026-08-12T21:00:00.000Z")] }
  }).level,
  "none",
  "A newer backup restores without a warning"
);

check(
  assessRestoreRegression({
    backupExportedAt: "2026-08-12T21:02:20.000Z",
    backupDataset: { tasks: currentDataset.tasks },
    currentUpdatedAt: "2026-08-12T21:02:40.000Z",
    currentDataset
  }).level,
  "none",
  "Clock drift of a few seconds is not treated as a regression"
);

check(
  assessRestoreRegression({
    backupExportedAt: "2026-08-13T09:00:00.000Z",
    backupDataset: { tasks: [] },
    currentUpdatedAt: "2026-08-12T21:02:00.000Z",
    currentDataset: {
      tasks: Array.from({ length: 8 }, (_, i) => task(`t${i}`, "2026-08-12T20:00:00.000Z"))
    }
  }).level,
  "caution",
  "A newer but nearly empty backup still warns about what disappears"
);

check(
  assessRestoreRegression({
    backupExportedAt: "壊れた日付",
    backupDataset: { tasks: [{ id: "a", title: "a" }] },
    currentUpdatedAt: "",
    currentDataset: { tasks: [{ id: "b", title: "b" }] }
  }).comparable,
  false,
  "Unreadable dates are reported as such rather than assumed safe"
);

// A browser that has never written the update stamp is dated from its records.
check(
  getDatasetActivityAt(currentDataset),
  "2026-08-12T21:01:00.000Z",
  "A dataset is dated by its newest record"
);
check(
  getDatasetActivityAt({
    tasks: [],
    parentCases: [{ createdAt: "2026-01-01T00:00:00.000Z", ideaMemos: [
      { createdAt: "2026-03-01T00:00:00.000Z" }
    ] }]
  }),
  "2026-03-01T00:00:00.000Z",
  "Parent cases and their idea memos count as activity"
);
check(getDatasetActivityAt({ tasks: [] }), "", "An empty dataset has no activity date");

check(formatElapsedJa(30 * 1000), "1分未満", "Elapsed time reads naturally");
check(formatElapsedJa(45 * 60000), "45分", "Elapsed time reads naturally");
check(formatElapsedJa(3 * 3600000), "約3時間", "Elapsed time reads naturally");
check(formatElapsedJa(50 * 3600000), "約2日", "Elapsed time reads naturally");
check(
  formatElapsedJa(2 * 3600000 + 59 * 60000 + 58000),
  "約3時間",
  "An 'about' figure rounds rather than understating what a restore discards"
);

// --- cloud history retention ------------------------------------------------

const day = 86400000;
const now = Date.UTC(2026, 7, 12, 9, 0, 0);
// 40 entries today, then one per day for the previous 40 days.
const history = [
  ...Array.from({ length: 40 }, (_, i) => ({ name: `today-${i}`, date: new Date(now - i * 60000) })),
  ...Array.from({ length: 40 }, (_, i) => ({ name: `day-${i}`, date: new Date(now - (i + 1) * day) }))
];

check(selectExpiredHistory(history.slice(0, 30)).length, 0, "Nothing expires below the recent limit");

const expired = selectExpiredHistory(history);
const kept = history.filter((entry) => !expired.includes(entry));
check(kept.length, 60, "Retention is bounded");
check(
  kept.slice(0, 30).every((entry, index) => entry === history[index]),
  true,
  "The 30 newest restore points are always kept"
);
const keptDays = kept.slice(30).map((entry) => entry.date.toISOString().slice(0, 10));
check(
  new Set(keptDays).size,
  keptDays.length,
  "Older entries are thinned to one per day"
);
check(keptDays.length <= 30, true, "Long-term coverage is capped at 30 days");

check(
  selectExpiredHistory([
    ...Array.from({ length: 31 }, (_, i) => ({ name: `n${i}`, date: new Date(now - i * 60000) })),
    { name: "unreadable", date: null }
  ]).some((entry) => entry.name === "unreadable"),
  false,
  "A restore point with an unreadable timestamp is never deleted"
);

// --- backup validation is shared with the cloud reader ----------------------

const validDocument = {
  format: "TodoMemo Backup",
  schemaVersion: 3,
  tasks: [{ id: "a", title: "タスク" }],
  tags: [],
  sync: { revision: 3 }
};
check(validateBackup(validDocument).sync.revision, 3, "Revision metadata survives validation");
let rejected = false;
try {
  validateBackup({ format: "Other", schemaVersion: 3, tasks: [], tags: [] });
} catch (_error) {
  rejected = true;
}
check(rejected, true, "A foreign document is rejected before it can be applied");

check(describeTodoMemoDevice(), "Windows / Chrome", "Devices are labelled for the conflict prompt");
check(getTodoMemoDeviceId(), getTodoMemoDeviceId(), "The device id is stable across calls");

console.log("Cloud-sync tests: OK");
