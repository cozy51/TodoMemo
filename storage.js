const TODO_MEMO_STORAGE_KEY = "todoMemoTasks";
const TODO_MEMO_TAGS_STORAGE_KEY = "todoMemoTags";
const TODO_MEMO_PARENT_CASES_STORAGE_KEY = "todoMemoParentCases";
const TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY = "todoMemoBackupSnapshot";
const TODO_MEMO_MAX_LINKS = 3;
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

function getCaseNumberPrefix(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `TD${year}-${month}`;
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
  return `(${caseNumber}) ${title} [\n${content}\n]\n`;
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
  const result = await chrome.storage.local.get(TODO_MEMO_TAGS_STORAGE_KEY);
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

  await chrome.storage.local.set({
    [TODO_MEMO_TAGS_STORAGE_KEY]: normalized
  });

  return normalized;
}

async function loadParentCases() {
  const result = await chrome.storage.local.get(TODO_MEMO_PARENT_CASES_STORAGE_KEY);
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
    await chrome.storage.local.set({
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
  await chrome.storage.local.set({
    [TODO_MEMO_PARENT_CASES_STORAGE_KEY]: normalized
  });
  return normalized;
}

async function loadTasks() {
  const result = await chrome.storage.local.get(TODO_MEMO_STORAGE_KEY);
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
    await chrome.storage.local.set({
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

  await chrome.storage.local.set({
    [TODO_MEMO_STORAGE_KEY]: normalized
  });

  return normalized;
}

function createBackupSnapshot(tasks, tags, parentCases) {
  return {
    tasks: tasks.map((task) => ({ ...task })),
    tags: tags.map((tag) => ({ ...tag })),
    parentCases: parentCases.map((parentCase) => ({ ...parentCase }))
  };
}

async function saveBackupSnapshot(tasks, tags, parentCases) {
  const snapshot = createBackupSnapshot(tasks, tags, parentCases);
  await chrome.storage.local.set({
    [TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY]: snapshot
  });
  return snapshot;
}

async function loadBackupSnapshot() {
  const result = await chrome.storage.local.get(TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY);
  const snapshot = result[TODO_MEMO_BACKUP_SNAPSHOT_STORAGE_KEY];
  if (!snapshot || !Array.isArray(snapshot.tasks)
    || !Array.isArray(snapshot.tags) || !Array.isArray(snapshot.parentCases)) {
    return null;
  }
  return snapshot;
}

function countCollectionChanges(currentItems, backupItems) {
  const currentById = new Map(currentItems.map((item) => [String(item.id), item]));
  const backupById = new Map(backupItems.map((item) => [String(item.id), item]));
  const ids = new Set([...currentById.keys(), ...backupById.keys()]);
  let changes = 0;
  ids.forEach((id) => {
    if (JSON.stringify(currentById.get(id)) !== JSON.stringify(backupById.get(id))) {
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
