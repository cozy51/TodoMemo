const taskView = document.querySelector("#taskView");
const emptyView = document.querySelector("#emptyView");
const editView = document.querySelector("#editView");
const taskTitle = document.querySelector("#taskTitle");
const taskCaseNumber = document.querySelector("#taskCaseNumber");
const taskParentCase = document.querySelector("#taskParentCase");
const editCaseNumber = document.querySelector("#editCaseNumber");
const editEyebrow = document.querySelector("#editEyebrow");
const copyTaskButton = document.querySelector("#copyTaskButton");
const taskContent = document.querySelector("#taskContent");
const taskDue = document.querySelector("#taskDue");
const taskTags = document.querySelector("#taskTags");
const taskLinks = document.querySelector("#taskLinks");
const taskPasteLinkButton = document.querySelector("#taskPasteLinkButton");
const editTaskButton = document.querySelector("#editTaskButton");
const editTaskForm = document.querySelector("#editTaskForm");
const editTitleInput = document.querySelector("#editTitleInput");
const editParentCaseSelect = document.querySelector("#editParentCaseSelect");
const editContentInput = document.querySelector("#editContentInput");
const editContentHighlightBackdrop = document.querySelector("#editContentHighlightBackdrop");
const editDueDateInput = document.querySelector("#editDueDateInput");
const clearEditDueDateButton = document.querySelector("#clearEditDueDate");
const editTagsField = document.querySelector("#editTagsField");
const editTagOptions = document.querySelector("#editTagOptions");
const editLinkInputs = document.querySelector("#editLinkInputs");
const editPasteLinkButton = document.querySelector("#editPasteLinkButton");
const editLinkMessage = document.querySelector("#editLinkMessage");
const editTitleError = document.querySelector("#editTitleError");
const autoSaveStatus = document.querySelector("#autoSaveStatus");
const backupButton = document.querySelector("#backupButton");
const backupChangeCount = document.querySelector("#backupChangeCount");
const popupToast = document.querySelector("#popupToast");

let currentTaskId = null;
let currentTask = null;
let allTasks = [];
let tags = [];
let parentCases = [];
let saveRevision = 0;
let latestSavePromise = Promise.resolve();
let popupToastTimer = null;
let isCreatingTask = false;

enableMarkdownTabInput(editContentInput);
const resizeEditContent = enableAutoResizeTextarea(editContentInput);

function renderEditContentSelectionHighlights() {
  const selectedText = editContentInput.value.slice(
    editContentInput.selectionStart,
    editContentInput.selectionEnd
  );
  editContentHighlightBackdrop.replaceChildren();
  if (!selectedText || selectedText.includes("\n")) {
    editContentHighlightBackdrop.textContent = editContentInput.value;
    return;
  }

  let start = 0;
  let matchIndex = editContentInput.value.indexOf(selectedText);
  while (matchIndex >= 0) {
    editContentHighlightBackdrop.append(document.createTextNode(
      editContentInput.value.slice(start, matchIndex)
    ));
    const mark = document.createElement("mark");
    mark.textContent = selectedText;
    editContentHighlightBackdrop.append(mark);
    start = matchIndex + selectedText.length;
    matchIndex = editContentInput.value.indexOf(selectedText, start);
  }
  editContentHighlightBackdrop.append(
    document.createTextNode(editContentInput.value.slice(start))
  );
}

function syncEditContentHighlightScroll() {
  editContentHighlightBackdrop.scrollTop = editContentInput.scrollTop;
  editContentHighlightBackdrop.scrollLeft = editContentInput.scrollLeft;
}

function openOrganizer() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function showPopupToast(message, state = "success") {
  popupToast.textContent = message;
  popupToast.dataset.state = state;
  popupToast.hidden = false;
  clearTimeout(popupToastTimer);
  popupToastTimer = setTimeout(() => {
    popupToast.hidden = true;
  }, 2600);
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function createBackupTimestamp(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-") + "_" + [
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes())
  ].join("");
}

async function downloadBackup() {
  backupButton.disabled = true;

  try {
    if (!editView.hidden) {
      if (!persistEditorChanges({ quiet: true })) {
        showPopupToast("タイトルを入力してからバックアップしてください", "error");
        return;
      }
      await latestSavePromise;
    }

    const [tasks, storedTags, storedParentCases] = await Promise.all([
      loadTasks(),
      loadTags(),
      loadParentCases()
    ]);
    const now = new Date();
    const timestamp = createBackupTimestamp(now);
    const manifestVersion = chrome.runtime.getManifest
      ? chrome.runtime.getManifest().version
      : "unknown";
    const backup = {
      format: "TodoMemo Backup",
      schemaVersion: 2,
      extensionVersion: manifestVersion,
      exportedAt: now.toISOString(),
      localTimestamp: timestamp,
      counts: {
        tasks: tasks.length,
        active: tasks.filter((task) => !task.completed).length,
        completed: tasks.filter((task) => task.completed).length,
        tags: storedTags.length,
        parentCases: storedParentCases.length
      },
      tasks,
      tags: storedTags,
      parentCases: storedParentCases
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-ext_TodoMemo_${timestamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await saveBackupSnapshot(tasks, storedTags, storedParentCases);
    updateBackupChangeCount(tasks, storedTags, storedParentCases, createBackupSnapshot(
      tasks, storedTags, storedParentCases
    ));
    showPopupToast(`${tasks.length}件をバックアップしました`);
  } catch (_error) {
    showPopupToast("バックアップを作成できませんでした", "error");
  } finally {
    backupButton.disabled = false;
  }
}

function updateBackupChangeCount(tasks, storedTags, storedParentCases, snapshot) {
  const count = countChangesSinceBackup(tasks, storedTags, storedParentCases, snapshot);
  backupChangeCount.textContent = count === null ? "–" : String(count);
  backupChangeCount.hidden = count === null;
  backupChangeCount.dataset.state = count > 0 ? "changed" : "saved";
  backupButton.title = count === null
    ? "全データをバックアップ（前回バックアップなし）"
    : `全データをバックアップ（前回から変更 ${count}件）`;
  backupButton.setAttribute("aria-label", backupButton.title);
}

function renderDue(dueDate) {
  if (!dueDate) {
    taskDue.textContent = "期限なし";
    taskDue.dataset.state = "none";
    return;
  }

  const dueState = getDueState(dueDate);
  const prefix = dueState === "overdue"
    ? "期限超過"
    : dueState === "today"
      ? "今日まで"
      : "期限";

  taskDue.textContent = `${prefix} · ${formatDueDate(dueDate)} · ${formatDueDistance(dueDate)}`;
  taskDue.dataset.state = dueState;
}

function renderTags(tagIds) {
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
  taskTags.replaceChildren(...selectedTags.map((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = ensureEmojiPresentation(tag.name);
    chip.style.setProperty("--tag-color", tag.color);
    return chip;
  }));
  taskTags.hidden = selectedTags.length === 0;
}

function createTaskLink(link, className = "task-link") {
  const presentation = getTaskLinkPresentation(link);
  const anchor = document.createElement("a");
  anchor.className = className;
  anchor.href = link;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.title = `${presentation.type}: ${link}`;
  anchor.setAttribute("aria-label", `${presentation.type}を開く: ${presentation.label}`);

  const icon = document.createElement("span");
  icon.className = "task-link-icon";
  renderTaskLinkIcon(icon, presentation);
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "task-link-label";
  label.textContent = presentation.label;
  anchor.append(icon, label);
  return anchor;
}

function renderTaskLinkIcon(container, presentation) {
  container.replaceChildren();
  if (presentation.iconAsset) {
    const image = document.createElement("img");
    image.src = presentation.iconAsset;
    image.alt = "";
    container.append(image);
  } else {
    container.textContent = presentation.icon;
  }
}

function renderLinks(container, links) {
  container.replaceChildren(...links.map((link) => createTaskLink(link)));
  container.hidden = links.length === 0;
}

function updateLinkInputIcon(row) {
  const input = row.querySelector(".link-url-input");
  const icon = row.querySelector(".link-input-icon");
  const presentation = input.value.trim()
    ? getTaskLinkPresentation(input.value)
    : { icon: "🔗" };
  renderTaskLinkIcon(icon, presentation);
}

function renderLinkInputs(links = []) {
  editLinkInputs.replaceChildren(...Array.from({ length: TODO_MEMO_MAX_LINKS }, (_, index) => {
    const row = document.createElement("div");
    row.className = "link-input-row";

    const icon = document.createElement("span");
    icon.className = "link-input-icon";
    icon.setAttribute("aria-hidden", "true");

    const input = document.createElement("input");
    input.className = "link-url-input";
    input.type = "text";
    input.inputMode = "url";
    input.autocomplete = "off";
    input.placeholder = index === 0 ? "https://… または mailto:…" : "URLを追加";
    input.value = links[index] || "";
    input.setAttribute("aria-label", `関連リンク ${index + 1}`);

    const remove = document.createElement("button");
    remove.className = "remove-link-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "このリンクを削除";
    remove.setAttribute("aria-label", `関連リンク ${index + 1} を削除`);

    row.append(icon, input, remove);
    updateLinkInputIcon(row);
    return row;
  }));
}

function collectLinkInputValues() {
  return normalizeTaskLinks(
    [...editLinkInputs.querySelectorAll(".link-url-input")].map((input) => input.value)
  );
}

function setLinkMessage(message, state = "") {
  editLinkMessage.textContent = message;
  editLinkMessage.dataset.state = state;
}

async function pasteLinksFromClipboard() {
  editPasteLinkButton.disabled = true;
  try {
    const pastedLinks = extractTaskLinks(await navigator.clipboard.readText());
    if (pastedLinks.length === 0) {
      setLinkMessage("クリップボードにURLが見つかりませんでした。", "error");
      return;
    }

    const inputs = [...editLinkInputs.querySelectorAll(".link-url-input")];
    const existing = new Set(collectLinkInputValues());
    let added = 0;
    pastedLinks.forEach((link) => {
      if (existing.has(link)) return;
      const emptyInput = inputs.find((input) => !input.value.trim());
      if (!emptyInput) return;
      emptyInput.value = link;
      existing.add(link);
      updateLinkInputIcon(emptyInput.closest(".link-input-row"));
      added += 1;
    });

    if (added === 0) {
      setLinkMessage(existing.size >= TODO_MEMO_MAX_LINKS
        ? "リンクは3件までです。"
        : "同じリンクがすでに登録されています。", "error");
      return;
    }
    setLinkMessage(`${added}件のリンクを追加しました。`, "success");
    persistEditorChanges();
  } catch (_error) {
    setLinkMessage("クリップボードを読み取れませんでした。", "error");
  } finally {
    editPasteLinkButton.disabled = false;
  }
}

async function pasteLinksToCurrentTask() {
  if (!currentTask) return;
  if (currentTask.links.length >= TODO_MEMO_MAX_LINKS) {
    showPopupToast("リンクは3件までです", "error");
    return;
  }

  taskPasteLinkButton.disabled = true;
  try {
    const pastedLinks = extractTaskLinks(await navigator.clipboard.readText());
    if (pastedLinks.length === 0) {
      showPopupToast("クリップボードにURLが見つかりません", "error");
      return;
    }

    const target = allTasks.find((task) => task.id === currentTaskId);
    if (!target) return;

    const links = [...target.links];
    const existing = new Set(links);
    pastedLinks.forEach((link) => {
      if (links.length >= TODO_MEMO_MAX_LINKS || existing.has(link)) return;
      links.push(link);
      existing.add(link);
    });

    const added = links.length - target.links.length;
    if (added === 0) {
      showPopupToast("同じリンクがすでに登録されています", "error");
      return;
    }

    target.links = links;
    const snapshot = allTasks.map((task) => ({
      ...task,
      tagIds: [...task.tagIds],
      links: [...task.links]
    }));
    allTasks = await saveTasks(snapshot);
    currentTask = allTasks.find((task) => task.id === currentTaskId) || currentTask;
    renderLinks(taskLinks, currentTask.links);
    showPopupToast(`${added}件のリンクを追加しました`);
  } catch (_error) {
    showPopupToast("クリップボードを読み取れませんでした", "error");
  } finally {
    taskPasteLinkButton.disabled = false;
  }
}

function renderTagOptions(selectedIds) {
  editTagOptions.replaceChildren(...tags.map((tag) => {
    const label = document.createElement("label");
    label.className = "tag-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tag.id;
    input.checked = selectedIds.includes(tag.id);

    const text = document.createElement("span");
    text.textContent = ensureEmojiPresentation(tag.name);
    text.style.setProperty("--tag-color", tag.color);
    label.append(input, text);
    return label;
  }));
  editTagsField.hidden = tags.length === 0;
}

function updateDueDateClearButton() {
  clearEditDueDateButton.hidden = !editDueDateInput.value;
}

function renderParentCaseOptions(selectedId = "") {
  editParentCaseSelect.replaceChildren(
    new Option("親案件なし", ""),
    ...parentCases.map((parentCase) =>
      new Option(`${parentCase.caseNumber}｜${parentCase.name}`, parentCase.id)
    )
  );
  editParentCaseSelect.value = parentCases.some((parentCase) => parentCase.id === selectedId)
    ? selectedId
    : "";
}

async function render() {
  const [tasks, storedTags, storedParentCases, backupSnapshot] = await Promise.all([
    loadTasks(),
    loadTags(),
    loadParentCases(),
    loadBackupSnapshot()
  ]);
  allTasks = tasks;
  tags = storedTags;
  parentCases = storedParentCases;
  updateBackupChangeCount(tasks, storedTags, storedParentCases, backupSnapshot);
  const activeTasks = tasks.filter((task) => !task.completed);
  const editingTask = !editView.hidden
    ? activeTasks.find((task) => task.id === currentTaskId)
    : null;
  currentTask = editingTask || activeTasks[0] || null;

  if (!currentTask) {
    currentTaskId = null;
    taskView.hidden = true;
    editView.hidden = true;
    emptyView.hidden = false;
    editTaskButton.hidden = true;
    return;
  }

  currentTaskId = currentTask.id;
  renderCurrentTaskDetails();

  emptyView.hidden = true;
  const isEditing = !editView.hidden;
  editTaskButton.hidden = isEditing;
  if (!isEditing) taskView.hidden = false;
}

function renderCurrentTaskDetails() {
  if (!currentTask) return;
  taskCaseNumber.textContent = `案件番号 ${currentTask.caseNumber}`;
  taskTitle.textContent = ensureEmojiPresentation(currentTask.title);
  const parentCase = parentCases.find((item) => item.id === currentTask.parentCaseId);
  taskParentCase.replaceChildren();
  taskParentCase.hidden = !parentCase;
  if (parentCase) {
    const appendParentCaseLabel = (container) => {
      const kind = document.createElement("span");
      kind.className = "parent-case-kind";
      kind.textContent = "親案件";

      const number = document.createElement("span");
      number.className = "parent-case-inline-number";
      number.textContent = parentCase.caseNumber;

      const title = document.createElement("strong");
      title.className = "parent-case-title-text";
      title.textContent = ensureEmojiPresentation(parentCase.name);
      container.append(kind, number, title);
    };
    if (parentCase.url) {
      const link = document.createElement("a");
      link.href = parentCase.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = parentCase.url;
      appendParentCaseLabel(link);
      taskParentCase.append(link);
    } else {
      appendParentCaseLabel(taskParentCase);
    }
  }
  renderMarkdown(taskContent, currentTask.content);
  renderDue(currentTask.dueDate);
  renderTags(currentTask.tagIds);
  renderLinks(taskLinks, currentTask.links);
}

async function copyCurrentTask() {
  if (!currentTask) return;
  try {
    await navigator.clipboard.writeText(formatTaskForCopy(currentTask));
    showPopupToast("案件をコピーしました");
  } catch (_error) {
    showPopupToast("案件をコピーできませんでした", "error");
  }
}

function openEditor() {
  if (!currentTask) return;

  isCreatingTask = false;
  editEyebrow.textContent = "今することを編集";
  editCaseNumber.textContent = `案件番号 ${currentTask.caseNumber}`;
  editTitleInput.value = currentTask.title;
  renderParentCaseOptions(currentTask.parentCaseId);
  editContentInput.value = currentTask.content;
  renderEditContentSelectionHighlights();
  editDueDateInput.value = currentTask.dueDate;
  updateDueDateClearButton();
  editTitleError.textContent = "";
  autoSaveStatus.hidden = true;
  renderTagOptions(currentTask.tagIds);
  renderLinkInputs(currentTask.links);
  setLinkMessage("URLまたはメールアドレスを登録できます。");

  taskView.hidden = true;
  editView.hidden = false;
  editTaskButton.hidden = true;
  requestAnimationFrame(() => {
    resizeEditContent();
    editTitleInput.focus();
  });
}

function openNewTaskEditor() {
  isCreatingTask = true;
  currentTaskId = null;
  editEyebrow.textContent = "新しいタスク";
  editCaseNumber.textContent = "案件番号は保存時に自動採番します";
  editTitleInput.value = "";
  renderParentCaseOptions();
  editContentInput.value = "";
  renderEditContentSelectionHighlights();
  editDueDateInput.value = "";
  updateDueDateClearButton();
  editTitleError.textContent = "";
  autoSaveStatus.hidden = true;
  renderTagOptions([]);
  renderLinkInputs([]);
  setLinkMessage("URLまたはメールアドレスを登録できます。");
  taskView.hidden = true;
  emptyView.hidden = true;
  editView.hidden = false;
  editTaskButton.hidden = true;
  requestAnimationFrame(() => editTitleInput.focus());
}

function handleTaskViewDoubleClick(event) {
  if (event.target.closest("a, button, input, textarea, select, label, [contenteditable]")) {
    return;
  }
  openEditor();
}

async function closeEditor() {
  if (isCreatingTask && !editTitleInput.value.trim()) {
    isCreatingTask = false;
    editView.hidden = true;
    taskView.hidden = !currentTask;
    emptyView.hidden = Boolean(currentTask);
    editTaskButton.hidden = !currentTask;
    return;
  }
  if (!persistEditorChanges({ quiet: true })) return;
  await latestSavePromise.catch(() => undefined);
  currentTask = allTasks.find((task) => !task.completed) || currentTask;
  currentTaskId = currentTask?.id || null;
  renderCurrentTaskDetails();
  editView.hidden = true;
  taskView.hidden = false;
  editTaskButton.hidden = false;
}

function persistEditorChanges({ quiet = false } = {}) {
  const title = editTitleInput.value.trim();

  if (!title) {
    editTitleError.textContent = "タイトルを入力してください";
    autoSaveStatus.textContent = "タイトルが必要です";
    autoSaveStatus.dataset.state = "error";
    editTitleInput.focus();
    return false;
  }

  editTitleError.textContent = "";
  let target = allTasks.find((task) => task.id === currentTaskId);
  if (!target && isCreatingTask) {
    let caseNumber;
    try {
      caseNumber = generateCaseNumber(allTasks);
    } catch (_error) {
      autoSaveStatus.textContent = "今月の案件番号はすべて使用されています";
      autoSaveStatus.dataset.state = "error";
      return false;
    }
    target = {
      id: crypto.randomUUID(), caseNumber, title: "", content: "", dueDate: "",
      parentCaseId: "", tagIds: [], links: [], completed: false,
      order: 1, createdAt: new Date().toISOString(), completedAt: null
    };
    const active = allTasks.filter((task) => !task.completed);
    const completed = allTasks.filter((task) => task.completed);
    active.push(target);
    allTasks = [...active, ...completed];
    currentTaskId = target.id;
    currentTask = target;
    isCreatingTask = false;
    editEyebrow.textContent = "タスクを編集";
    editCaseNumber.textContent = `案件番号 ${caseNumber}`;
  }
  if (!target) return false;

  target.title = title;
  target.parentCaseId = editParentCaseSelect.value;
  target.content = editContentInput.value;
  target.dueDate = editDueDateInput.value;
  target.tagIds = [...editTagOptions.querySelectorAll("input:checked")]
    .map((input) => input.value);
  target.links = collectLinkInputValues();
  currentTask = target;

  const snapshot = allTasks.map((task) => ({
    ...task,
    tagIds: [...task.tagIds],
    links: [...task.links]
  }));
  const revision = ++saveRevision;
  if (!quiet) {
    autoSaveStatus.textContent = "保存中…";
    autoSaveStatus.dataset.state = "saving";
  }

  latestSavePromise = saveTasks(snapshot);
  latestSavePromise
    .then((savedTasks) => {
      if (revision !== saveRevision) return;
      allTasks = savedTasks;
      currentTask = allTasks.find((task) => task.id === currentTaskId) || currentTask;
      autoSaveStatus.textContent = "保存済み";
      autoSaveStatus.dataset.state = "saved";
    })
    .catch(() => {
      if (revision !== saveRevision) return;
    });

  return true;
}

function markEditorDirty() {
  autoSaveStatus.hidden = true;
}

document.querySelector("#openOrganizer").addEventListener("click", openOrganizer);
document.querySelector("#newTaskButton").addEventListener("click", openNewTaskEditor);
document.querySelector("#openOrganizerEmpty").addEventListener("click", openOrganizer);
backupButton.addEventListener("click", downloadBackup);
document.querySelector("#cancelEditTop").addEventListener("click", closeEditor);
editTaskButton.addEventListener("click", openEditor);
copyTaskButton.addEventListener("click", copyCurrentTask);
taskView.addEventListener("dblclick", handleTaskViewDoubleClick);
editTaskForm.addEventListener("submit", (event) => event.preventDefault());
editTitleInput.addEventListener("input", () => {
  if (editTitleInput.value.trim()) editTitleError.textContent = "";
  markEditorDirty();
});
editParentCaseSelect.addEventListener("change", markEditorDirty);
editContentInput.addEventListener("input", () => {
  renderEditContentSelectionHighlights();
  markEditorDirty();
});
editContentInput.addEventListener("select", renderEditContentSelectionHighlights);
editContentInput.addEventListener("keyup", renderEditContentSelectionHighlights);
editContentInput.addEventListener("pointerup", renderEditContentSelectionHighlights);
editContentInput.addEventListener("dblclick", () => {
  requestAnimationFrame(() => {
    trimTrailingSpacingFromSelection(editContentInput);
    renderEditContentSelectionHighlights();
  });
});
editContentInput.addEventListener("scroll", syncEditContentHighlightScroll);
editDueDateInput.addEventListener("input", () => {
  updateDueDateClearButton();
  markEditorDirty();
});
clearEditDueDateButton.addEventListener("click", () => {
  editDueDateInput.value = "";
  updateDueDateClearButton();
  markEditorDirty();
  editDueDateInput.focus();
});
editTagOptions.addEventListener("change", markEditorDirty);
editLinkInputs.addEventListener("input", (event) => {
  const input = event.target.closest(".link-url-input");
  if (!input) return;
  updateLinkInputIcon(input.closest(".link-input-row"));
  setLinkMessage(
    input.value.trim() && !normalizeTaskLink(input.value)
      ? "http://、https://、mailto:、またはメールアドレスを入力してください。"
      : "URLまたはメールアドレスを登録できます。",
    input.value.trim() && !normalizeTaskLink(input.value) ? "error" : ""
  );
  markEditorDirty();
});
editLinkInputs.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-link-button");
  if (!button) return;
  const row = button.closest(".link-input-row");
  row.querySelector(".link-url-input").value = "";
  updateLinkInputIcon(row);
  setLinkMessage("リンクを削除しました。", "success");
  markEditorDirty();
});
editPasteLinkButton.addEventListener("click", pasteLinksFromClipboard);
taskPasteLinkButton.addEventListener("click", pasteLinksToCurrentTask);
window.addEventListener("pagehide", () => {
  if (!editView.hidden) persistEditorChanges({ quiet: true });
});
chrome.storage.onChanged.addListener(render);

render();
