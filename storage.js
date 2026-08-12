const TODO_MEMO_APP_VERSION = "1.11.0";
const TODO_MEMO_STORAGE_KEY = "todoMemoTasks";
const TODO_MEMO_TAGS_STORAGE_KEY = "todoMemoTags";
const TODO_MEMO_PARENT_CASES_STORAGE_KEY = "todoMemoParentCases";
const TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY = "todoMemoBackupSnapshot";
const TODO_MEMO_HOLIDAYS_STORAGE_KEY = "todoMemoHolidays";
const TODO_MEMO_SYNC_STATE_STORAGE_KEY = "todoMemoSyncState";
const TODO_MEMO_DEVICE_ID_STORAGE_KEY = "todoMemoDeviceId";
const TODO_MEMO_DATA_UPDATED_AT_STORAGE_KEY = "todoMemoDataUpdatedAt";
// Clocks between devices drift, so a file has to look meaningfully older than
// the current data before the restore is treated as a step backwards.
const TODO_MEMO_STALE_RESTORE_TOLERANCE_MS = 60 * 1000;
const TODO_MEMO_MAX_LINKS = 3;
const TODO_MEMO_MAX_PARENT_IDEA_MEMOS = 50;
const TODO_MEMO_DATASET_STORAGE_KEYS = [
  TODO_MEMO_STORAGE_KEY,
  TODO_MEMO_TAGS_STORAGE_KEY,
  TODO_MEMO_PARENT_CASES_STORAGE_KEY,
  TODO_MEMO_HOLIDAYS_STORAGE_KEY
];
// Fingerprints are order sensitive, so the collection order is fixed here.
const TODO_MEMO_DATASET_COLLECTIONS = ["tasks", "tags", "parentCases", "holidays"];

// Keep the persistence API asynchronous so the rest of the application can
// remain unchanged, while storing every collection in the browser's native
// localStorage.  The custom event keeps multiple views in the same tab in sync;
// the native `storage` event handles other tabs.
//
// localStorage is the offline copy; Supabase holds the authoritative version.
// A write that came *from* the cloud must not be pushed back, so `set` accepts
// `{ origin: "cloud" }` to suppress the upload while still refreshing the UI.
const todoMemoStorage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return { [key]: value === null ? undefined : JSON.parse(value) };
    } catch (_error) {
      return { [key]: undefined };
    }
  },
  async set(items, options = {}) {
    Object.entries(items).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    // Remember when the data last changed, so a restore can tell whether the
    // file it is about to apply predates what is already here.
    if (Object.keys(items).some((key) => TODO_MEMO_DATASET_STORAGE_KEYS.includes(key))) {
      try {
        localStorage.setItem(
          TODO_MEMO_DATA_UPDATED_AT_STORAGE_KEY,
          options.updatedAt || new Date().toISOString()
        );
      } catch (_error) {
        // Without the stamp a restore falls back to the timestamps in the data.
      }
    }
    window.dispatchEvent(new CustomEvent("todomemo-storage-change"));
    if (options.origin === "cloud") return;
    // Cloud synchronisation is deliberately fire-and-forget: a network or
    // authentication failure must never turn a successful local save into an
    // application error.
    window.todoMemoCloudSync?.notifyLocalChange();
  }
};
const TODO_MEMO_CASE_LETTERS = [..."ABCDEFGHJKLMNQRSTUVWXYZ"];
const TODO_MEMO_CASE_SEQUENCE = [
  ...Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, "0")),
  ...TODO_MEMO_CASE_LETTERS.flatMap((letter) =>
    Array.from({ length: 10 }, (_, digit) => `${letter}${digit}`)
  )
];
const TODO_MEMO_CASE_NUMBER_PATTERN = /^TD\d{2}-(?:0[1-9]|1[0-2])(?:0[1-9]|[1-9]\d|[A-HJ-NQ-Z]\d)$/;
const TODO_MEMO_PARENT_CASE_SEQUENCE = [..."123456789ABCDEFGHJKLMNPQRSTUVWXYZ"];
const TODO_MEMO_PARENT_CASE_NUMBER_PATTERN = /^TD\d{2}-(?:0[1-9]|1[0-2])P[1-9A-HJ-NP-Z]$/;

function normalizeHoliday(holiday) {
  const date = String(holiday?.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    return null;
  }
  return {
    date,
    type: holiday?.type === "company" ? "company" : "personal"
  };
}

async function loadHolidays() {
  const result = await todoMemoStorage.get(TODO_MEMO_HOLIDAYS_STORAGE_KEY);
  return (Array.isArray(result[TODO_MEMO_HOLIDAYS_STORAGE_KEY])
    ? result[TODO_MEMO_HOLIDAYS_STORAGE_KEY]
    : [])
    .map(normalizeHoliday)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function saveHolidays(holidays) {
  const byDate = new Map();
  holidays.map(normalizeHoliday).filter(Boolean).forEach((holiday) => {
    byDate.set(holiday.date, holiday);
  });
  const normalized = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  await todoMemoStorage.set({ [TODO_MEMO_HOLIDAYS_STORAGE_KEY]: normalized });
  return normalized;
}

function getCaseNumberPrefix(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `TD${year}-${month}`;
}

function isCaseNumberForMonth(caseNumber, date = new Date()) {
  return String(caseNumber || "").trim().toUpperCase().startsWith(getCaseNumberPrefix(date));
}

function generateCaseNumber(tasks, date = new Date()) {
  const prefix = getCaseNumberPrefix(date);
  const usedSuffixes = new Set(
    tasks
      .map((task) => String(task.caseNumber || "").trim().toUpperCase())
      .filter((caseNumber) => caseNumber.startsWith(prefix))
      .map((caseNumber) => caseNumber.slice(prefix.length))
  );

  const suffix = TODO_MEMO_CASE_SEQUENCE.find((candidate) => !usedSuffixes.has(candidate));
  if (!suffix) {
    throw new RangeError(`${prefix}の案件番号をこれ以上採番できません`);
  }
  return `${prefix}${suffix}`;
}

function getTaskCaseNumberDate(task) {
  const createdAt = new Date(task.createdAt);
  return Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
}

function assignCaseNumbers(tasks) {
  const usedCaseNumbers = new Set();
  const needsCaseNumber = [];

  tasks.forEach((task) => {
    const caseNumber = String(task.caseNumber || "").trim().toUpperCase();
    if (TODO_MEMO_CASE_NUMBER_PATTERN.test(caseNumber) && !usedCaseNumbers.has(caseNumber)) {
      task.caseNumber = caseNumber;
      usedCaseNumbers.add(caseNumber);
    } else {
      task.caseNumber = "";
      needsCaseNumber.push(task);
    }
  });

  needsCaseNumber.forEach((task) => {
    task.caseNumber = generateCaseNumber(tasks, getTaskCaseNumberDate(task));
    usedCaseNumbers.add(task.caseNumber);
  });

  return tasks;
}

function getParentCaseNumberPrefix(date = new Date()) {
  return `${getCaseNumberPrefix(date)}P`;
}

function generateParentCaseNumber(parentCases, date = new Date()) {
  const prefix = getParentCaseNumberPrefix(date);
  const usedSuffixes = new Set(
    parentCases
      .map((parentCase) => String(parentCase.caseNumber || "").trim().toUpperCase())
      .filter((caseNumber) => caseNumber.startsWith(prefix))
      .map((caseNumber) => caseNumber.slice(prefix.length))
  );

  const suffix = TODO_MEMO_PARENT_CASE_SEQUENCE.find((candidate) => !usedSuffixes.has(candidate));
  if (!suffix) {
    throw new RangeError(`${prefix}の親案件番号をこれ以上採番できません`);
  }
  return `${prefix}${suffix}`;
}

function assignParentCaseNumbers(parentCases) {
  const usedCaseNumbers = new Set();
  const needsCaseNumber = [];

  parentCases.forEach((parentCase) => {
    const caseNumber = String(parentCase.caseNumber || "").trim().toUpperCase();
    if (
      TODO_MEMO_PARENT_CASE_NUMBER_PATTERN.test(caseNumber) &&
      !usedCaseNumbers.has(caseNumber)
    ) {
      parentCase.caseNumber = caseNumber;
      usedCaseNumbers.add(caseNumber);
    } else {
      parentCase.caseNumber = "";
      needsCaseNumber.push(parentCase);
    }
  });

  needsCaseNumber.forEach((parentCase) => {
    const createdAt = new Date(parentCase.createdAt);
    const numberDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
    parentCase.caseNumber = generateParentCaseNumber(parentCases, numberDate);
    usedCaseNumbers.add(parentCase.caseNumber);
  });

  return parentCases;
}

function sortParentCasesByNumberDescending(parentCases) {
  return [...parentCases].sort((a, b) =>
    String(b.caseNumber || "").localeCompare(String(a.caseNumber || ""), "en")
  );
}

function sortTasksByCaseNumberDescending(tasks) {
  return [...tasks].sort((a, b) =>
    String(b.caseNumber || "").localeCompare(String(a.caseNumber || ""), "en")
  );
}

function groupTasksByParentCase(parentCases, tasks) {
  const validParentIds = new Set(parentCases.map((parentCase) => parentCase.id));
  const priorityByTaskId = new Map(tasks.map((task, index) => [task.id, index]));
  const parentGroups = sortParentCasesByNumberDescending(parentCases).map((parentCase) => ({
    parentCase,
    tasks: tasks.filter((task) => task.parentCaseId === parentCase.id)
  }));
  const highestPriorityByParentId = new Map(parentGroups.map((group) => [
    group.parentCase.id,
    group.tasks.reduce(
      (best, task) => Math.min(best, priorityByTaskId.get(task.id) ?? Number.POSITIVE_INFINITY),
      Number.POSITIVE_INFINITY
    )
  ]));
  parentGroups.sort((a, b) => {
    const priorityOrder = highestPriorityByParentId.get(a.parentCase.id)
      - highestPriorityByParentId.get(b.parentCase.id);
    if (priorityOrder !== 0 && !Number.isNaN(priorityOrder)) return priorityOrder;
    return String(b.parentCase.caseNumber || "")
      .localeCompare(String(a.parentCase.caseNumber || ""), "en");
  });
  return [
    ...parentGroups,
    {
      parentCase: null,
      tasks: tasks.filter(
        (task) => !task.parentCaseId || !validParentIds.has(task.parentCaseId)
      )
    }
  ];
}

function moveActiveTaskToPriority(tasks, taskId, priority) {
  const active = tasks.filter((task) => !task.completed);
  const completed = tasks.filter((task) => task.completed);
  const currentIndex = active.findIndex((task) => task.id === taskId);
  if (currentIndex < 0) return [...active, ...completed];

  const [task] = active.splice(currentIndex, 1);
  const destination = Math.max(0, Math.min(active.length, Number(priority) - 1));
  active.splice(destination, 0, task);
  return [...active, ...completed];
}

function formatTaskForCopy(task) {
  const caseNumber = String(task.caseNumber || "").trim();
  const title = String(task.title || "").trim();
  const content = String(task.content || "").replace(/\r\n?/g, "\n");
  return `${caseNumber}_${title} [\n${content}\n]\n`;
}

function formatTaskHeadingForCopy(task) {
  const caseNumber = String(task.caseNumber || "").trim();
  const title = String(task.title || "").trim();
  return `${caseNumber}_${title}`;
}

function formatParentCaseForCopy(parentCase) {
  const caseNumber = String(parentCase.caseNumber || "").trim();
  const name = String(parentCase.name || "").trim();
  return [name, caseNumber].filter(Boolean).join("_");
}

function countContentLines(content) {
  const normalized = String(content || "").replace(/\r\n?/g, "\n").trimEnd();
  return normalized.trim() ? normalized.split("\n").length : 0;
}

function formatTasksForCopy(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "";

  const blocks = tasks.map((task) => {
    const caseNumber = String(task.caseNumber || "").trim();
    const title = String(task.title || "").trim();
    const content = String(task.content || "").replace(/\r\n?/g, "\n");
    return `${caseNumber} ${title} [\n${content}\n]`;
  });
  return `${blocks.join("\n\n")}\n`;
}

function normalizeTaskLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidate = /^[^\s:@]+@[^\s@]+\.[^\s@]+$/.test(raw)
    ? `mailto:${raw}`
    : raw;

  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.href
      : "";
  } catch (_error) {
    return "";
  }
}

function normalizeParentCaseUrl(value) {
  const normalized = normalizeTaskLink(value);
  if (!normalized) return "";
  const url = new URL(normalized);
  return ["http:", "https:"].includes(url.protocol) ? normalized : "";
}

function normalizeParentIdeaMemos(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((memo) => ({
      id: String(memo?.id || crypto.randomUUID()),
      text: String(memo?.text || "").trim().slice(0, 500),
      createdAt: memo?.createdAt || new Date().toISOString()
    }))
    .filter((memo) => memo.text)
    .slice(0, TODO_MEMO_MAX_PARENT_IDEA_MEMOS);
}

function removeParentIdeaMemo(parentCases, parentCaseId, memoId) {
  return parentCases.map((parentCase) => parentCase.id === parentCaseId
    ? {
        ...parentCase,
        ideaMemos: parentCase.ideaMemos.filter((memo) => memo.id !== memoId)
      }
    : parentCase);
}

function moveParentIdeaMemo(parentCases, parentCaseId, memoId, direction) {
  return parentCases.map((parentCase) => {
    if (parentCase.id !== parentCaseId) return parentCase;
    const ideaMemos = [...parentCase.ideaMemos];
    const currentIndex = ideaMemos.findIndex((memo) => memo.id === memoId);
    const destination = currentIndex + direction;
    if (currentIndex < 0 || destination < 0 || destination >= ideaMemos.length) {
      return parentCase;
    }
    [ideaMemos[currentIndex], ideaMemos[destination]] = [
      ideaMemos[destination], ideaMemos[currentIndex]
    ];
    return { ...parentCase, ideaMemos };
  });
}

function formatParentIdeaMemoPreview(ideaMemos, maxItems = 5, maxTextLength = 40) {
  const memos = Array.isArray(ideaMemos) ? ideaMemos : [];
  const lines = memos.slice(0, maxItems).map((memo, index) => {
    const text = String(memo?.text || "").replace(/\s+/g, " ").trim();
    const preview = text.length > maxTextLength
      ? `${text.slice(0, maxTextLength)}…`
      : text;
    return `${index + 1}. ${preview}`;
  });
  if (memos.length > maxItems) lines.push(`ほか${memos.length - maxItems}件`);
  return lines.join("\n");
}

function normalizeTaskLinks(values) {
  const normalized = Array.isArray(values)
    ? values.map(normalizeTaskLink).filter(Boolean)
    : [];
  return [...new Set(normalized)].slice(0, TODO_MEMO_MAX_LINKS);
}

function extractTaskLinks(text) {
  const source = String(text || "");
  const matches = source.match(/(?:https?:\/\/|mailto:)[^\s<>"']+|[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+/gi) || [];
  const normalized = matches
    .map((match) => match.replace(/[)\]}>）］｝〉》」』】,.;!?、。]+$/u, ""))
    .map(normalizeTaskLink)
    .filter(Boolean);
  return [...new Set(normalized)];
}

function getTaskLinkPresentation(value) {
  const normalized = normalizeTaskLink(value);
  if (!normalized) return { icon: "🔗", type: "リンク", label: "リンク" };

  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();
  const isSharePointLoopLink =
    /(^|\.)sharepoint\.com$/.test(host) &&
    (
      /^\/:fl:\//.test(path) ||
      /\/contentstorage\/csp_[^/]+(?:\/|$)/.test(path) ||
      /\.(?:fluid|loop)(?:\/|$)/.test(path)
    );

  if (
    /(^|\.)(loop\.cloud\.microsoft|loop\.microsoft\.com)$/.test(host) ||
    isSharePointLoopLink ||
    (
      /(^|\.)(m365\.cloud\.microsoft|microsoft365\.com|office\.com)$/.test(host) &&
      /^\/(?:launch\/)?loop(?:\/|$)/.test(path)
    )
  ) {
    return {
      icon: "",
      iconAsset: "assets/icons/microsoft-loop.svg",
      type: "Microsoft Loop",
      label: "Loop"
    };
  }
  if (
    /(^|\.)(outlook\.cloud\.microsoft|outlook\.office\.com|outlook\.office365\.com|outlook\.live\.com|outlook\.com)$/.test(host)
  ) {
    return {
      icon: "",
      iconAsset: "assets/icons/microsoft-outlook.svg",
      type: "Microsoft Outlook",
      label: "Outlook"
    };
  }
  if (
    url.protocol === "mailto:" ||
    host === "mail.google.com" ||
    /(^|\.)(gmail\.com|outlook\.com|outlook\.live\.com|outlook\.office\.com|outlook\.cloud\.microsoft|proton\.me|protonmail\.com|mail\.yahoo\.[a-z.]+)$/.test(host)
  ) {
    return {
      icon: "✉️",
      type: "メール",
      label: url.protocol === "mailto:" ? decodeURIComponent(url.pathname) : host
    };
  }
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/.test(host)) {
    return { icon: "🎬", type: "動画", label: host };
  }
  if (
    /(^|\.)(zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com)$/.test(host)
  ) {
    return { icon: "🎥", type: "会議", label: host };
  }
  if (
    (
      /(^|\.)(maps\.google\.|google\.[a-z.]+$)/.test(host) &&
      path.includes("/maps")
    ) ||
    host === "maps.app.goo.gl" ||
    /(^|\.)(maps\.apple\.com|map\.yahoo\.co\.jp)$/.test(host)
  ) {
    return { icon: "🗺️", type: "地図", label: host };
  }
  if (host === "drive.google.com") {
    return {
      icon: "",
      iconAsset: "assets/icons/google-drive.svg",
      type: "Google Drive",
      label: "Drive"
    };
  }
  if (host === "notebooklm.google.com") {
    return {
      icon: "",
      iconAsset: "assets/icons/gemini-notebook.svg",
      type: "Gemini Notebook",
      label: "Notebook"
    };
  }
  if (
    /(^|\.)(docs\.google\.com|drive\.google\.com|notion\.so|dropbox\.com|box\.com)$/.test(host)
  ) {
    return { icon: "📄", type: "文書", label: host };
  }
  if (/(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(host)) {
    return { icon: "💻", type: "開発", label: host };
  }
  if (
    /(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|linkedin\.com|threads\.net)$/.test(host)
  ) {
    return { icon: "💬", type: "SNS", label: host };
  }
  if (
    /(^|\.)(amazon\.[a-z.]+|rakuten\.co\.jp|shopping\.yahoo\.co\.jp)$/.test(host)
  ) {
    return { icon: "🛒", type: "買い物", label: host };
  }

  return { icon: "🔗", type: "リンク", label: host || normalized };
}

function normalizeTask(task, index) {
  return {
    id: String(task.id || crypto.randomUUID()),
    caseNumber: String(task.caseNumber || "").trim().toUpperCase(),
    parentCaseId: String(task.parentCaseId || ""),
    title: String(task.title || "").trim(),
    content: String(task.content || "").replace(/\r\n?/g, "\n"),
    dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
    tagIds: Array.isArray(task.tagIds) ? [...new Set(task.tagIds.map(String))] : [],
    links: normalizeTaskLinks(task.links),
    completed: Boolean(task.completed),
    order: Number.isFinite(task.order) ? task.order : index,
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
  };
}

function normalizeParentCase(parentCase) {
  return {
    id: String(parentCase.id || crypto.randomUUID()),
    caseNumber: String(parentCase.caseNumber || "").trim().toUpperCase(),
    name: String(parentCase.name || "").trim(),
    url: normalizeParentCaseUrl(parentCase.url),
    ideaMemos: normalizeParentIdeaMemos(parentCase.ideaMemos),
    createdAt: parentCase.createdAt || new Date().toISOString()
  };
}

function normalizeTag(tag) {
  const color = typeof tag.color === "string" && /^#[0-9a-f]{6}$/i.test(tag.color)
    ? tag.color.toLowerCase()
    : "#2f6fed";
  return {
    id: String(tag.id || crypto.randomUUID()),
    name: String(tag.name || "").trim(),
    color
  };
}

async function loadTags() {
  const result = await todoMemoStorage.get(TODO_MEMO_TAGS_STORAGE_KEY);
  const storedTags = Array.isArray(result[TODO_MEMO_TAGS_STORAGE_KEY])
    ? result[TODO_MEMO_TAGS_STORAGE_KEY]
    : [];

  return storedTags
    .map(normalizeTag)
    .filter((tag) => tag.name);
}

async function saveTags(tags) {
  const normalized = tags
    .map(normalizeTag)
    .filter((tag) => tag.name);

  await todoMemoStorage.set({
    [TODO_MEMO_TAGS_STORAGE_KEY]: normalized
  });

  return normalized;
}

async function loadParentCases() {
  const result = await todoMemoStorage.get(TODO_MEMO_PARENT_CASES_STORAGE_KEY);
  const storedParentCases = Array.isArray(result[TODO_MEMO_PARENT_CASES_STORAGE_KEY])
    ? result[TODO_MEMO_PARENT_CASES_STORAGE_KEY]
    : [];
  const normalized = sortParentCasesByNumberDescending(assignParentCaseNumbers(
    storedParentCases
      .map(normalizeParentCase)
      .filter((parentCase) => parentCase.name)
  ));

  const storedById = new Map(
    storedParentCases.map((parentCase) => [String(parentCase?.id || ""), parentCase])
  );
  const numbersChanged = normalized.some((parentCase) => {
    const stored = storedById.get(parentCase.id);
    return String(stored?.caseNumber || "").trim().toUpperCase() !== parentCase.caseNumber;
  });
  if (numbersChanged) {
    await todoMemoStorage.set({
      [TODO_MEMO_PARENT_CASES_STORAGE_KEY]: normalized
    });
  }
  return normalized;
}

async function saveParentCases(parentCases) {
  const normalized = sortParentCasesByNumberDescending(assignParentCaseNumbers(
    parentCases
      .map(normalizeParentCase)
      .filter((parentCase) => parentCase.name)
  ));
  await todoMemoStorage.set({
    [TODO_MEMO_PARENT_CASES_STORAGE_KEY]: normalized
  });
  return normalized;
}

async function loadTasks() {
  const result = await todoMemoStorage.get(TODO_MEMO_STORAGE_KEY);
  const storedTasks = Array.isArray(result[TODO_MEMO_STORAGE_KEY])
    ? result[TODO_MEMO_STORAGE_KEY]
    : [];

  const normalized = storedTasks
    .map(normalizeTask)
    .sort((a, b) => a.order - b.order);
  assignCaseNumbers(normalized);

  const storedTasksById = new Map(
    storedTasks.map((task) => [String(task?.id || ""), task])
  );
  const caseNumbersChanged = normalized.some((task) => {
    const storedTask = storedTasksById.get(task.id);
    return String(storedTask?.caseNumber || "").trim().toUpperCase() !== task.caseNumber;
  });
  if (caseNumbersChanged) {
    await todoMemoStorage.set({
      [TODO_MEMO_STORAGE_KEY]: normalized
    });
  }

  return normalized;
}

async function saveTasks(tasks) {
  const normalized = assignCaseNumbers(tasks.map((task, index) => ({
    ...normalizeTask(task, index),
    order: index
  })));

  await todoMemoStorage.set({
    [TODO_MEMO_STORAGE_KEY]: normalized
  });

  return normalized;
}

function createItemFingerprint(item) {
  const source = JSON.stringify(item);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createCollectionSnapshot(items) {
  return items.map((item) => ({
    id: String(item.id),
    fingerprint: createItemFingerprint(item)
  }));
}

function createBackupSnapshot(tasks, tags, parentCases) {
  return {
    version: 2,
    tasks: createCollectionSnapshot(tasks),
    tags: createCollectionSnapshot(tags),
    parentCases: createCollectionSnapshot(parentCases)
  };
}

async function saveBackupSnapshot(tasks, tags, parentCases) {
  const snapshot = createBackupSnapshot(tasks, tags, parentCases);
  await todoMemoStorage.set({
    [TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY]: snapshot
  });
  return snapshot;
}

async function loadBackupSnapshot() {
  const result = await todoMemoStorage.get(TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY);
  const snapshot = result[TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY];
  if (!snapshot || !Array.isArray(snapshot.tasks)
    || !Array.isArray(snapshot.tags) || !Array.isArray(snapshot.parentCases)) {
    return null;
  }
  if (snapshot.version === 2) return snapshot;

  // Version 1 stored complete records and could consume excessive browser storage.
  // Compact it as soon as the app loads so ordinary task saves keep working.
  const compactSnapshot = createBackupSnapshot(
    snapshot.tasks, snapshot.tags, snapshot.parentCases
  );
  await todoMemoStorage.set({
    [TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY]: compactSnapshot
  });
  return compactSnapshot;
}

function countCollectionChanges(currentItems, backupItems) {
  const currentById = new Map(currentItems.map((item) => [
    String(item.id), createItemFingerprint(item)
  ]));
  const backupById = new Map(backupItems.map((item) => [
    String(item.id), item.fingerprint || createItemFingerprint(item)
  ]));
  const ids = new Set([...currentById.keys(), ...backupById.keys()]);
  let changes = 0;
  ids.forEach((id) => {
    if (currentById.get(id) !== backupById.get(id)) {
      changes += 1;
    }
  });
  return changes;
}

function countChangesSinceBackup(tasks, tags, parentCases, snapshot) {
  if (!snapshot) return null;
  return countCollectionChanges(tasks, snapshot.tasks)
    + countCollectionChanges(tags, snapshot.tags)
    + countCollectionChanges(parentCases, snapshot.parentCases);
}

// ---------------------------------------------------------------------------
// Cloud synchronisation helpers
//
// Supabase holds the authoritative copy of the data and localStorage keeps an
// offline copy of it.  Every cloud document carries a monotonically increasing
// `sync.revision`; each browser remembers the revision its local copy is based
// on.  A device may only overwrite the cloud when the revision it is based on
// still matches the one stored there, which is what stops an idle or offline
// machine from resurrecting old data on top of newer work.
// ---------------------------------------------------------------------------

function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("バックアップファイルではありません");
  }
  if (
    data.format !== "TodoMemo Backup" ||
    ![1, 2, 3].includes(data.schemaVersion)
  ) {
    throw new Error("対応していないバックアップ形式です");
  }
  if (!Array.isArray(data.tasks) || !Array.isArray(data.tags)) {
    throw new Error("タスクまたはタグのデータがありません");
  }
  const backupParentCases = data.parentCases === undefined ? [] : data.parentCases;
  const backupHolidays = data.holidays === undefined ? [] : data.holidays;
  if (!Array.isArray(backupParentCases)) {
    throw new Error("親案件のデータが不正です");
  }
  if (!Array.isArray(backupHolidays) || backupHolidays.some((holiday) => !normalizeHoliday(holiday))) {
    throw new Error("休みのデータが不正です");
  }
  if (
    data.tasks.length > 10000 ||
    data.tags.length > 1000 ||
    backupParentCases.length > 1000
  ) {
    throw new Error("バックアップの件数が多すぎます");
  }

  const taskIds = new Set();
  data.tasks.forEach((task) => {
    if (!task || typeof task !== "object" || !String(task.title || "").trim()) {
      throw new Error("タイトルのないタスクが含まれています");
    }
    const id = String(task.id || "");
    if (!id || taskIds.has(id)) {
      throw new Error("タスクIDが不正または重複しています");
    }
    taskIds.add(id);
    if (task.tagIds !== undefined && !Array.isArray(task.tagIds)) {
      throw new Error("タスクのタグ情報が不正です");
    }
    if (task.links !== undefined && !Array.isArray(task.links)) {
      throw new Error("タスクのリンク情報が不正です");
    }
  });

  const tagIds = new Set();
  data.tags.forEach((tag) => {
    if (!tag || typeof tag !== "object" || !String(tag.name || "").trim()) {
      throw new Error("名前のないタグが含まれています");
    }
    const id = String(tag.id || "");
    if (!id || tagIds.has(id)) {
      throw new Error("タグIDが不正または重複しています");
    }
    tagIds.add(id);
  });

  const parentCaseIds = new Set();
  backupParentCases.forEach((parentCase) => {
    if (
      !parentCase ||
      typeof parentCase !== "object" ||
      !String(parentCase.name || "").trim()
    ) {
      throw new Error("名前のない親案件が含まれています");
    }
    const id = String(parentCase.id || "");
    if (!id || parentCaseIds.has(id)) {
      throw new Error("親案件IDが不正または重複しています");
    }
    parentCaseIds.add(id);
  });

  data.parentCases = backupParentCases;
  data.holidays = backupHolidays;
  return data;
}

// Normalize an arbitrary backup payload the same way the app normalizes its own
// state, so a cloud document and the local copy can be compared byte for byte.
function normalizeDataset(source) {
  const tags = (Array.isArray(source?.tags) ? source.tags : [])
    .map(normalizeTag)
    .filter((tag) => tag.name);
  const validTagIds = new Set(tags.map((tag) => tag.id));

  const parentCases = sortParentCasesByNumberDescending(assignParentCaseNumbers(
    (Array.isArray(source?.parentCases) ? source.parentCases : [])
      .map(normalizeParentCase)
      .filter((parentCase) => parentCase.name)
  ));
  const validParentCaseIds = new Set(parentCases.map((parentCase) => parentCase.id));

  const tasks = assignCaseNumbers(
    (Array.isArray(source?.tasks) ? source.tasks : []).map((task, index) => ({
      ...normalizeTask(task, index),
      tagIds: Array.isArray(task?.tagIds)
        ? task.tagIds.map(String).filter((tagId) => validTagIds.has(tagId))
        : [],
      parentCaseId: validParentCaseIds.has(String(task?.parentCaseId || ""))
        ? String(task.parentCaseId)
        : "",
      order: index
    }))
  );

  const holidays = (Array.isArray(source?.holidays) ? source.holidays : [])
    .map(normalizeHoliday)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { tasks, tags, parentCases, holidays };
}

async function loadTodoMemoDataset() {
  const [tasks, tags, parentCases, holidays] = await Promise.all([
    loadTasks(),
    loadTags(),
    loadParentCases(),
    loadHolidays()
  ]);
  return { tasks, tags, parentCases, holidays };
}

async function saveTodoMemoDataset(dataset, options = {}) {
  await todoMemoStorage.set({
    [TODO_MEMO_STORAGE_KEY]: dataset.tasks,
    [TODO_MEMO_TAGS_STORAGE_KEY]: dataset.tags,
    [TODO_MEMO_PARENT_CASES_STORAGE_KEY]: dataset.parentCases,
    [TODO_MEMO_HOLIDAYS_STORAGE_KEY]: dataset.holidays
  }, options);
  return dataset;
}

function countDatasetRecords(dataset) {
  return TODO_MEMO_DATASET_COLLECTIONS.reduce(
    (total, name) => total + (Array.isArray(dataset?.[name]) ? dataset[name].length : 0),
    0
  );
}

function isDatasetEmpty(dataset) {
  return countDatasetRecords(dataset) === 0;
}

// A 32-bit hash alone would make an undetected collision — a change that never
// reaches the cloud — a real if unlikely risk, so combine two independent
// hashes with the serialized length.
function createDatasetFingerprint(dataset) {
  const source = JSON.stringify(
    TODO_MEMO_DATASET_COLLECTIONS.map((name) => dataset?.[name] ?? [])
  );
  let low = 2166136261;
  let high = 40389;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    low = Math.imul(low ^ code, 16777619);
    high = Math.imul(high ^ (code + index), 2246822519);
  }
  return `${source.length.toString(36)}.${(low >>> 0).toString(36)}.${(high >>> 0).toString(36)}`;
}

function getTodoMemoDeviceId() {
  let deviceId = "";
  try {
    deviceId = localStorage.getItem(TODO_MEMO_DEVICE_ID_STORAGE_KEY) || "";
  } catch (_error) {
    deviceId = "";
  }
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    try {
      localStorage.setItem(TODO_MEMO_DEVICE_ID_STORAGE_KEY, deviceId);
    } catch (_error) {
      // A device without persistent storage still syncs; it just looks new.
    }
  }
  return deviceId;
}

function describeTodoMemoDevice() {
  const agent = typeof navigator === "undefined" ? "" : String(navigator.userAgent || "");
  const platform = /Windows/.test(agent) ? "Windows"
    : /Macintosh|Mac OS/.test(agent) ? "Mac"
    : /iPhone|iPad|iPod/.test(agent) ? "iOS"
    : /Android/.test(agent) ? "Android"
    : /Linux/.test(agent) ? "Linux"
    : "不明な端末";
  const browser = /Edg\//.test(agent) ? "Edge"
    : /OPR\//.test(agent) ? "Opera"
    : /Chrome\//.test(agent) ? "Chrome"
    : /Firefox\//.test(agent) ? "Firefox"
    : /Safari\//.test(agent) ? "Safari"
    : "ブラウザー";
  return `${platform} / ${browser}`;
}

function createEmptySyncState() {
  return {
    userId: "",
    revision: 0,
    fingerprint: "",
    remoteUpdatedAt: "",
    lastSyncedAt: ""
  };
}

function loadTodoMemoSyncState(userId = "") {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(TODO_MEMO_SYNC_STATE_STORAGE_KEY));
  } catch (_error) {
    stored = null;
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return createEmptySyncState();
  }
  const state = {
    userId: String(stored.userId || ""),
    revision: Number.isFinite(stored.revision) && stored.revision > 0
      ? Math.floor(stored.revision)
      : 0,
    fingerprint: String(stored.fingerprint || ""),
    remoteUpdatedAt: String(stored.remoteUpdatedAt || ""),
    lastSyncedAt: String(stored.lastSyncedAt || "")
  };
  // Revisions belong to one account's document; another account's history says
  // nothing about how fresh this browser's copy is.
  if (userId && state.userId && state.userId !== userId) return createEmptySyncState();
  return state;
}

function saveTodoMemoSyncState(state) {
  // Sync bookkeeping is local metadata, never part of the synced payload, so it
  // is written directly instead of through `todoMemoStorage.set`.
  const next = { ...createEmptySyncState(), ...state };
  try {
    localStorage.setItem(TODO_MEMO_SYNC_STATE_STORAGE_KEY, JSON.stringify(next));
  } catch (_error) {
    // Ignore quota errors: the next sync simply re-detects the state.
  }
  return next;
}

// Decide what to do with a cloud document without touching either copy, so the
// rule that prevents older data from winning stays small enough to test.
function decideSyncAction(input) {
  const {
    remoteExists,
    remoteLegacy = false,
    remoteRevision = 0,
    remoteFingerprint = "",
    baseRevision = 0,
    baseFingerprint = "",
    localFingerprint = "",
    localEmpty = false
  } = input;

  // A browser that has never synced and holds nothing has no opinion to defend;
  // one that *has* synced and is now empty was emptied by an action, so that
  // deletion is a real edit and has to pass the accidental-wipe guard instead of
  // being silently undone.
  const hasLineage = baseRevision > 0 || baseFingerprint !== "";
  const unsynced = localEmpty && !hasLineage;

  if (!remoteExists) return unsynced ? "idle" : "push";

  // Edits this browser made that the cloud has never seen.
  const localDirty = !unsynced && localFingerprint !== baseFingerprint;

  // Identical content needs no transfer; only the revision lineage is adjusted.
  if (remoteFingerprint === localFingerprint) {
    // Except when upgrading from a pre-revision document: give it a revision now
    // so the first later edit is an ordinary push rather than a conflict.
    if (remoteLegacy) return "push";
    return remoteRevision === baseRevision ? "idle" : "adopt";
  }

  // Documents written before revisions existed carry no ordering information,
  // so guessing which side is newer is exactly the mistake to avoid.
  if (remoteLegacy) return localDirty ? "conflict" : "pull";

  if (remoteRevision > baseRevision) return localDirty ? "conflict" : "pull";
  // The cloud moved backwards relative to this browser: never silently accept
  // it, and never silently overwrite it either.
  if (remoteRevision < baseRevision) return "conflict";
  return localDirty ? "push" : "pull";
}

// Guard against the accidental wipe: a cleared browser profile, a mis-clicked
// bulk delete, or a restore from a much older file must not quietly shrink the
// authoritative copy.
function assessDatasetShrink(remoteDataset, localDataset) {
  const remoteCount = countDatasetRecords(remoteDataset);
  const localCount = countDatasetRecords(localDataset);
  if (remoteCount === 0) return null;
  if (localCount === 0) {
    return { reason: "empty", remoteCount, localCount, removed: remoteCount };
  }
  const removed = remoteCount - localCount;
  if (remoteCount >= 5 && removed >= Math.ceil(remoteCount / 2)) {
    return { reason: "shrink", remoteCount, localCount, removed };
  }
  return null;
}

function loadTodoMemoDataUpdatedAt() {
  try {
    return String(localStorage.getItem(TODO_MEMO_DATA_UPDATED_AT_STORAGE_KEY) || "");
  } catch (_error) {
    return "";
  }
}

// The newest timestamp anywhere in a dataset.  Browsers that have not written
// the update stamp yet — and backup files, which never carry one — can still be
// dated from the records themselves.
function getDatasetActivityAt(dataset) {
  let newest = 0;
  const consider = (value) => {
    const time = new Date(value ?? NaN).getTime();
    if (Number.isFinite(time) && time > newest) newest = time;
  };
  (dataset?.tasks || []).forEach((task) => {
    consider(task?.createdAt);
    consider(task?.completedAt);
  });
  (dataset?.parentCases || []).forEach((parentCase) => {
    consider(parentCase?.createdAt);
    (parentCase?.ideaMemos || []).forEach((memo) => consider(memo?.createdAt));
  });
  return newest ? new Date(newest).toISOString() : "";
}

function pickNewestTimestamp(...values) {
  let newest = 0;
  values.forEach((value) => {
    const time = new Date(value ?? NaN).getTime();
    if (Number.isFinite(time) && time > newest) newest = time;
  });
  return newest ? new Date(newest).toISOString() : "";
}

// Restoring a file is the one path that can walk the data backwards on purpose,
// so it is judged on age rather than size alone: a backup taken before the
// current data was last changed would silently discard everything since.
function assessRestoreRegression({
  backupExportedAt, backupDataset, currentUpdatedAt, currentDataset
} = {}) {
  const backupAt = pickNewestTimestamp(backupExportedAt, getDatasetActivityAt(backupDataset));
  const currentAt = pickNewestTimestamp(currentUpdatedAt, getDatasetActivityAt(currentDataset));
  const shrink = assessDatasetShrink(currentDataset, backupDataset);
  const backupTime = Date.parse(backupAt);
  const currentTime = Date.parse(currentAt);
  const comparable = Number.isFinite(backupTime) && Number.isFinite(currentTime);
  const staleMs = comparable ? currentTime - backupTime : 0;

  const level = comparable && staleMs > TODO_MEMO_STALE_RESTORE_TOLERANCE_MS ? "danger"
    : shrink ? "caution"
    : "none";
  return { level, staleMs, backupAt, currentAt, shrink, comparable };
}

function formatElapsedJa(milliseconds) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60000);
  if (minutes < 1) return "1分未満";
  if (minutes < 60) return `${minutes}分`;
  // Rounded, because these read as "about": floor would call 2時間59分 "2時間",
  // understating what a restore would discard.
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `約${hours}時間`;
  return `約${Math.round(minutes / 1440)}日`;
}

// Cloud history retention.  Recent restore points are what undo a mis-click and
// older ones are what undo a mistake noticed days later, so keep every recent
// entry and thin everything older down to one per day.  `entries` must be newest
// first; the returned entries are the ones safe to delete.
function selectExpiredHistory(entries, { recentKeep = 30, dailyKeep = 30 } = {}) {
  if (!Array.isArray(entries) || entries.length <= recentKeep) return [];
  const keptDays = new Set();
  return entries.slice(recentKeep).filter((entry) => {
    const day = entry?.date instanceof Date && !Number.isNaN(entry.date.getTime())
      ? entry.date.toISOString().slice(0, 10)
      : null;
    // An entry whose timestamp cannot be read is kept: deleting a restore point
    // we do not understand is the one outcome worth avoiding here.
    if (!day) return false;
    if (keptDays.has(day)) return true;
    keptDays.add(day);
    return keptDays.size > dailyKeep;
  });
}

function formatDueDate(dueDate) {
  if (!dueDate) return "";

  const date = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function getDueState(dueDate) {
  if (!dueDate) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(due.getTime())) return "none";
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "future";
}

function getDueDistance(dueDate) {
  if (!dueDate) return null;

  const parts = dueDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dueUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  return Math.round((dueUtc - todayUtc) / 86400000);
}

function formatDueDistance(dueDate) {
  const distance = getDueDistance(dueDate);
  if (distance === null) return "";
  if (distance === 0) return "今日が期限";
  if (distance > 0) return `あと${distance}日`;
  return `${Math.abs(distance)}日超過`;
}
