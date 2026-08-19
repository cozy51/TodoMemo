const appVersion = document.querySelector("#appVersion");
const activeList = document.querySelector("#activeList");
const completedList = document.querySelector("#completedList");
const activeEmpty = document.querySelector("#activeEmpty");
const completedEmpty = document.querySelector("#completedEmpty");
const activeCount = document.querySelector("#activeCount");
const completedCount = document.querySelector("#completedCount");
const activeTaskSection = document.querySelector("#activeTaskSection");
const toggleActiveListButton = document.querySelector("#toggleActiveListButton");
const activeCollapsedNotice = document.querySelector("#activeCollapsedNotice");
const activeCollapsedCount = document.querySelector("#activeCollapsedCount");
const copyActiveTasksButton = document.querySelector("#copyActiveTasksButton");
const deadlineCalendar = document.querySelector("#deadlineCalendar");
const manageHolidaysButton = document.querySelector("#manageHolidaysButton");
const holidayDialog = document.querySelector("#holidayDialog");
const holidayForm = document.querySelector("#holidayForm");
const holidayDateInput = document.querySelector("#holidayDateInput");
const holidayTypeInput = document.querySelector("#holidayTypeInput");
const holidayList = document.querySelector("#holidayList");
const holidayEmpty = document.querySelector("#holidayEmpty");
const parentCaseJumpSelect = document.querySelector("#parentCaseJumpSelect");
const taskJumpSelect = document.querySelector("#taskJumpSelect");
const compactTaskTableBody = document.querySelector("#compactTaskTableBody");
const compactTaskCount = document.querySelector("#compactTaskCount");
const compactTaskEmpty = document.querySelector("#compactTaskEmpty");
const navCompactTaskCount = document.querySelector("#navCompactTaskCount");
const navActiveCount = document.querySelector("#navActiveCount");
const navParentCaseCount = document.querySelector("#navParentCaseCount");
const navTagCount = document.querySelector("#navTagCount");
const navCompletedCount = document.querySelector("#navCompletedCount");
const clearCompletedButton = document.querySelector("#clearCompletedButton");
const taskDialog = document.querySelector("#taskDialog");
const taskDetailDialog = document.querySelector("#taskDetailDialog");
const detailEditButton = document.querySelector("#detailEditButton");
const taskForm = document.querySelector("#taskForm");
const taskIdInput = document.querySelector("#taskId");
const titleInput = document.querySelector("#titleInput");
const dialogCaseNumber = document.querySelector("#dialogCaseNumber");
const parentCaseSelect = document.querySelector("#parentCaseSelect");
const prioritySelect = document.querySelector("#prioritySelect");
const contentInput = document.querySelector("#contentInput");
const contentHighlightBackdrop = document.querySelector("#contentHighlightBackdrop");
const dueDateInput = document.querySelector("#dueDateInput");
const clearDueDateButton = document.querySelector("#clearDueDateButton");
const taskTagsField = document.querySelector("#taskTagsField");
const taskTagOptions = document.querySelector("#taskTagOptions");
const linkInputs = document.querySelector("#linkInputs");
const pasteLinkButton = document.querySelector("#pasteLinkButton");
const linkMessage = document.querySelector("#linkMessage");
const titleError = document.querySelector("#titleError");
const dialogTitle = document.querySelector("#dialogTitle");
const taskAutoSaveStatus = document.querySelector("#taskAutoSaveStatus");
const cancelButton = document.querySelector("#cancelButton");
const deleteTaskButton = document.querySelector("#deleteTaskButton");
const toast = document.querySelector("#toast");
const tagForm = document.querySelector("#tagForm");
const tagNameInput = document.querySelector("#tagNameInput");
const tagList = document.querySelector("#tagList");
const tagEmpty = document.querySelector("#tagEmpty");
const tagCount = document.querySelector("#tagCount");
const tagError = document.querySelector("#tagError");
const parentCaseForm = document.querySelector("#parentCaseForm");
const parentCaseNameInput = document.querySelector("#parentCaseNameInput");
const parentCaseUrlInput = document.querySelector("#parentCaseUrlInput");
const parentCaseError = document.querySelector("#parentCaseError");
const parentCaseList = document.querySelector("#parentCaseList");
const parentCaseEmpty = document.querySelector("#parentCaseEmpty");
const parentCaseCount = document.querySelector("#parentCaseCount");
const parentCaseManageModeButton = document.querySelector("#parentCaseManageModeButton");
const parentCaseGroupModeButton = document.querySelector("#parentCaseGroupModeButton");
const parentCaseManageView = document.querySelector("#parentCaseManageView");
const parentCaseGroupView = document.querySelector("#parentCaseGroupView");
const parentCaseGroups = document.querySelector("#parentCaseGroups");
const parentIdeaDialog = document.querySelector("#parentIdeaDialog");
const parentIdeaDialogCaseNumber = document.querySelector("#parentIdeaDialogCaseNumber");
const parentIdeaDialogTitle = document.querySelector("#parentIdeaDialogTitle");
const parentIdeaDialogCount = document.querySelector("#parentIdeaDialogCount");
const parentIdeaDialogForm = document.querySelector("#parentIdeaDialogForm");
const parentIdeaDialogInput = document.querySelector("#parentIdeaDialogInput");
const parentIdeaDialogList = document.querySelector("#parentIdeaDialogList");
const parentIdeaDialogEmpty = document.querySelector("#parentIdeaDialogEmpty");
const backupButton = document.querySelector("#backupButton");
const backupChangeCount = document.querySelector("#backupChangeCount");
const restoreBackupButton = document.querySelector("#restoreBackupButton");
const restoreFileInput = document.querySelector("#restoreFileInput");
const restoreDialog = document.querySelector("#restoreDialog");
const restoreFileName = document.querySelector("#restoreFileName");
const restoreExportedAt = document.querySelector("#restoreExportedAt");
const restoreTaskCount = document.querySelector("#restoreTaskCount");
const restoreTagCount = document.querySelector("#restoreTagCount");
const restoreParentCaseCount = document.querySelector("#restoreParentCaseCount");
const restoreCurrentUpdatedAt = document.querySelector("#restoreCurrentUpdatedAt");
const restoreCurrentTaskCount = document.querySelector("#restoreCurrentTaskCount");
const restoreCurrentTagCount = document.querySelector("#restoreCurrentTagCount");
const restoreCurrentParentCaseCount = document.querySelector("#restoreCurrentParentCaseCount");
const restoreRegressionWarning = document.querySelector("#restoreRegressionWarning");
const restoreAcknowledgeRow = document.querySelector("#restoreAcknowledgeRow");
const restoreAcknowledge = document.querySelector("#restoreAcknowledge");
const confirmRestoreButton = document.querySelector("#confirmRestoreButton");

let tasks = [];
let tags = [];
let parentCases = [];
let holidays = [];
let parentCaseViewMode = "group";
let activeListCollapsed = true;
let draggedTaskId = null;
let toastTimer = null;
let pendingRestore = null;
let taskAutoSavePromise = Promise.resolve();
let parentIdeaSavePromise = Promise.resolve();
let parentIdeaSaveRevision = 0;
let detailTaskId = null;
let ideaMemoParentCaseId = null;
const TASK_AUTO_SAVE_DELAY_MS = 1200;

function removeRetiredInlineIdeaMemoEditors(root = parentCaseGroups) {
  if (root instanceof Element && root.matches(".parent-idea-memos")) root.remove();
  root.querySelectorAll?.(".parent-idea-memos").forEach((element) => element.remove());
}

new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) removeRetiredInlineIdeaMemoEditors(node);
    });
  });
}).observe(parentCaseGroups, { childList: true, subtree: true });

enableMarkdownTabInput(contentInput);
const resizeContentInput = enableAutoResizeTextarea(contentInput);

function renderContentSelectionHighlights() {
  const selectedText = contentInput.value.slice(
    contentInput.selectionStart,
    contentInput.selectionEnd
  );
  contentHighlightBackdrop.replaceChildren();
  if (!selectedText || selectedText.includes("\n")) {
    contentHighlightBackdrop.textContent = contentInput.value;
    return;
  }

  let start = 0;
  let matchIndex = contentInput.value.indexOf(selectedText);
  while (matchIndex >= 0) {
    contentHighlightBackdrop.append(document.createTextNode(
      contentInput.value.slice(start, matchIndex)
    ));
    const mark = document.createElement("mark");
    mark.textContent = selectedText;
    contentHighlightBackdrop.append(mark);
    start = matchIndex + selectedText.length;
    matchIndex = contentInput.value.indexOf(selectedText, start);
  }
  contentHighlightBackdrop.append(document.createTextNode(contentInput.value.slice(start)));
}

function syncContentHighlightScroll() {
  contentHighlightBackdrop.scrollTop = contentInput.scrollTop;
  contentHighlightBackdrop.scrollLeft = contentInput.scrollLeft;
}

function getActiveTasks() {
  return tasks.filter((task) => !task.completed);
}

function getCompletedTasks() {
  return tasks
    .filter((task) => task.completed)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
}

function getDeletableCompletedTasks(date = new Date()) {
  return getCompletedTasks().filter(
    (task) => !isCaseNumberForMonth(task.caseNumber, date)
  );
}

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompletedAt(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "完了日時：記録なし";
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
  return `完了日時：${formatted}`;
}

function createBackupTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

async function downloadBackup() {
  backupButton.disabled = true;
  try {
    const [storedTasks, storedTags, storedParentCases, storedHolidays] = await Promise.all([
      loadTasks(),
      loadTags(),
      loadParentCases(),
      loadHolidays()
    ]);
    const now = new Date();
    const timestamp = createBackupTimestamp(now);
    const backup = {
      format: "TodoMemo Backup",
      schemaVersion: 3,
      extensionVersion: TODO_MEMO_APP_VERSION,
      exportedAt: now.toISOString(),
      localTimestamp: timestamp,
      counts: {
        tasks: storedTasks.length,
        active: storedTasks.filter((task) => !task.completed).length,
        completed: storedTasks.filter((task) => task.completed).length,
        tags: storedTags.length,
        parentCases: storedParentCases.length,
        holidays: storedHolidays.length
      },
      tasks: storedTasks,
      tags: storedTags,
      parentCases: storedParentCases,
      holidays: storedHolidays
    };
    const url = URL.createObjectURL(new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json;charset=utf-8" }
    ));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-ext_TodoMemo_${timestamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await saveBackupSnapshot(storedTasks, storedTags, storedParentCases);
    updateBackupChangeCount(storedTasks, storedTags, storedParentCases, createBackupSnapshot(
      storedTasks, storedTags, storedParentCases
    ));
    showToast(`${storedTasks.length}件をバックアップしました`);
  } catch (_error) {
    showToast("バックアップを作成できませんでした", "error");
  } finally {
    backupButton.disabled = false;
  }
}

function updateBackupChangeCount(currentTasks, currentTags, currentParentCases, snapshot) {
  const count = countChangesSinceBackup(
    currentTasks, currentTags, currentParentCases, snapshot
  );
  backupChangeCount.textContent = count === null ? "未作成" : `変更 ${count}件`;
  backupChangeCount.dataset.state = count > 0 ? "changed" : "saved";
}

function getActiveTaskAnchorId(task) {
  return `active-task-${task.id}`;
}

function getActiveTaskAnchorHref(task) {
  return `#${encodeURIComponent(getActiveTaskAnchorId(task))}`;
}

function getCompletedTaskAnchorId(task) {
  return `completed-task-${task.id}`;
}

function getTaskAnchorHref(task) {
  const id = task.completed
    ? getCompletedTaskAnchorId(task)
    : getActiveTaskAnchorId(task);
  return `#${encodeURIComponent(id)}`;
}

function getParentCaseAnchorId(parentCase) {
  return `parent-case-${parentCase.id}`;
}

function jumpToElement(element) {
  if (!element) return;
  window.location.hash = `#${encodeURIComponent(element.id)}`;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCaseJumpOptions(activeTasks) {
  const parentPlaceholder = document.createElement("option");
  parentPlaceholder.value = "";
  parentPlaceholder.textContent = "親案件コード・親案件名から選択";
  parentPlaceholder.selected = true;
  parentPlaceholder.disabled = true;
  parentPlaceholder.hidden = true;
  parentCaseJumpSelect.replaceChildren(
    parentPlaceholder,
    ...sortParentCasesByNumberDescending(parentCases).map((parentCase) => {
      const option = document.createElement("option");
      option.value = parentCase.id;
      option.textContent = `${parentCase.caseNumber}｜${parentCase.name}`;
      return option;
    })
  );
  parentCaseJumpSelect.disabled = parentCases.length === 0;

  const taskPlaceholder = document.createElement("option");
  taskPlaceholder.value = "";
  taskPlaceholder.textContent = "案件コード・案件名から選択";
  taskPlaceholder.selected = true;
  taskPlaceholder.disabled = true;
  taskPlaceholder.hidden = true;
  taskJumpSelect.replaceChildren(
    taskPlaceholder,
    ...sortTasksByCaseNumberDescending(activeTasks).map((task) => {
      const option = document.createElement("option");
      option.value = task.id;
      option.textContent = `${task.caseNumber}｜${task.title}`;
      return option;
    })
  );
  taskJumpSelect.disabled = activeTasks.length === 0;
}

function createCalendarMonth(activeTasks, year, month, monthOffset) {
  const monthPanel = document.createElement("article");
  monthPanel.className = "calendar-month";

  const title = document.createElement("h3");
  title.textContent = `${year}年${month + 1}月`;
  if (monthOffset === 0) {
    const current = document.createElement("span");
    current.className = "calendar-current-month";
    current.textContent = "今月";
    title.append(current);
  }

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "calendar-weekdays";
  ["日", "月", "火", "水", "木", "金", "土"].forEach((weekday, index) => {
    const label = document.createElement("span");
    label.textContent = weekday;
    if (index === 0) label.className = "is-sunday";
    if (index === 6) label.className = "is-saturday";
    weekdayRow.append(label);
  });

  const todayKey = formatLocalDateKey(new Date());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDateKey = `${monthPrefix}01`;
  const lastDateKey = `${monthPrefix}${String(daysInMonth).padStart(2, "0")}`;
  const monthTasks = activeTasks
    .filter((task) => task.dueDate >= firstDateKey && task.dueDate <= lastDateKey)
    .sort((a, b) => {
      const dateOrder = a.dueDate.localeCompare(b.dueDate);
      return dateOrder || activeTasks.indexOf(a) - activeTasks.indexOf(b);
    });
  const tasksByDate = new Map();
  monthTasks.forEach((task) => {
    if (!tasksByDate.has(task.dueDate)) tasksByDate.set(task.dueDate, []);
    tasksByDate.get(task.dueDate).push(task);
  });

  const days = document.createElement("div");
  days.className = "calendar-days";
  const leadingDays = new Date(year, month, 1).getDay();
  const calendarCellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  for (let cellIndex = 0; cellIndex < calendarCellCount; cellIndex += 1) {
    const dayNumber = cellIndex - leadingDays + 1;
    const day = document.createElement("div");
    day.className = "calendar-day";
    if (cellIndex % 7 === 0) day.classList.add("is-sunday");
    if (cellIndex % 7 === 6) day.classList.add("is-saturday");

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      day.classList.add("is-outside");
      const outsideDate = new Date(year, month, dayNumber);
      const outsideDayNumber = document.createElement("span");
      outsideDayNumber.className = "calendar-day-number";
      outsideDayNumber.textContent = outsideDate.getDate();
      day.title = `${outsideDate.getMonth() + 1}月${outsideDate.getDate()}日`;
      day.setAttribute(
        "aria-label",
        `${outsideDate.getFullYear()}年${outsideDate.getMonth() + 1}月${outsideDate.getDate()}日（隣の月）`
      );
      day.append(outsideDayNumber);
      days.append(day);
      continue;
    }

    const dateKey = `${monthPrefix}${String(dayNumber).padStart(2, "0")}`;
    const holiday = holidays.find((item) => item.date === dateKey);
    const dayNumberLabel = document.createElement("span");
    dayNumberLabel.className = "calendar-day-number";
    dayNumberLabel.textContent = dayNumber;
    day.append(dayNumberLabel);

    day.classList.add("is-selectable");
    day.tabIndex = 0;
    if (holiday) {
      day.classList.add(`is-${holiday.type}-holiday`);
      const holidayName = holiday.type === "company" ? "会社の休み" : "自分の休み";
      day.title = `${month + 1}月${dayNumber}日（${holidayName}）`;
      day.setAttribute("aria-label", `${year}年${month + 1}月${dayNumber}日（${holidayName}）`);
    }
    const openHolidayForDay = (event) => {
      if (event.target.closest("a, details")) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      holidayDateInput.value = dateKey;
      holidayTypeInput.value = holiday?.type || "personal";
      renderHolidayList();
      holidayDialog.showModal();
    };
    day.addEventListener("click", openHolidayForDay);
    day.addEventListener("keydown", openHolidayForDay);

    if (dateKey === todayKey) day.classList.add("is-today");
    const dayTasks = tasksByDate.get(dateKey) || [];
    if (dayTasks.length > 0) {
      day.classList.add("has-deadline");
      if (dateKey < todayKey) day.classList.add("is-overdue");

      if (dayTasks.length === 1) {
        const countLink = document.createElement("a");
        countLink.className = "calendar-day-count";
        countLink.href = getActiveTaskAnchorHref(dayTasks[0]);
        countLink.textContent = "1件";
        countLink.setAttribute(
          "aria-label",
          `${month + 1}月${dayNumber}日が期限の案件へ移動`
        );
        day.append(countLink);
      } else {
        const picker = document.createElement("details");
        picker.className = "calendar-day-picker";
        if (cellIndex % 7 <= 2) picker.classList.add("opens-right");

        const summary = document.createElement("summary");
        summary.className = "calendar-day-count";
        summary.textContent = `${dayTasks.length}件`;
        summary.setAttribute(
          "aria-label",
          `${month + 1}月${dayNumber}日が期限の案件 ${dayTasks.length}件から選択`
        );

        const menu = document.createElement("div");
        menu.className = "calendar-day-menu";
        dayTasks.forEach((task) => {
          const taskLink = document.createElement("a");
          taskLink.href = getActiveTaskAnchorHref(task);
          taskLink.title = task.title;
          const caseNumber = document.createElement("span");
          caseNumber.textContent = task.caseNumber;
          const taskTitle = document.createElement("span");
          taskTitle.textContent = ensureEmojiPresentation(task.title);
          taskLink.append(caseNumber, taskTitle);
          menu.append(taskLink);
        });

        picker.addEventListener("toggle", () => {
          if (!picker.open) return;
          deadlineCalendar.querySelectorAll(".calendar-day-picker[open]").forEach((other) => {
            if (other !== picker) other.removeAttribute("open");
          });
        });
        picker.append(summary, menu);
        day.append(picker);
      }
    }
    days.append(day);
  }

  const deadlines = document.createElement("div");
  deadlines.className = "calendar-deadlines";
  if (monthTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "calendar-deadlines-empty";
    empty.textContent = "期限のある案件はありません";
    deadlines.append(empty);
  } else {
    const list = document.createElement("ul");
    monthTasks.forEach((task) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "calendar-deadline-link";
      link.href = getActiveTaskAnchorHref(task);
      link.title = `${task.caseNumber} ${task.title}`;
      if (task.dueDate < todayKey) link.classList.add("is-overdue");

      const date = document.createElement("time");
      date.dateTime = task.dueDate;
      date.textContent = `${Number(task.dueDate.slice(5, 7))}/${Number(task.dueDate.slice(8, 10))}`;
      const caseNumber = document.createElement("span");
      caseNumber.className = "calendar-deadline-case";
      caseNumber.textContent = task.caseNumber;
      const taskTitle = document.createElement("span");
      taskTitle.className = "calendar-deadline-title";
      taskTitle.textContent = ensureEmojiPresentation(task.title);
      link.append(date, caseNumber, taskTitle);
      item.append(link);
      list.append(item);
    });
    deadlines.append(list);
  }

  monthPanel.append(title, weekdayRow, days, deadlines);
  return monthPanel;
}

function renderHolidayList() {
  holidayList.replaceChildren(...holidays.map((holiday) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${holiday.date.replaceAll("-", "/")}　${holiday.type === "company" ? "会社の休み" : "自分の休み"}`;
    label.className = `is-${holiday.type}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "削除";
    remove.dataset.date = holiday.date;
    item.append(label, remove);
    return item;
  }));
  holidayEmpty.hidden = holidays.length > 0;
}

function renderDeadlineCalendar(activeTasks) {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = Array.from({ length: 3 }, (_, monthOffset) => {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + monthOffset, 1);
    return createCalendarMonth(
      activeTasks,
      date.getFullYear(),
      date.getMonth(),
      monthOffset
    );
  });
  deadlineCalendar.replaceChildren(...months);
}

function createCompactTaskRow(task, index) {
  const row = document.createElement("tr");
  if (index === 0) row.className = "is-current";
  row.tabIndex = 0;
  row.setAttribute("role", "link");
  row.setAttribute("aria-label", `${task.caseNumber} ${task.title}の詳細カードへ移動`);
  row.title = "クリックして詳細カードへ移動";

  const navigateToTask = () => {
    setActiveListCollapsed(false);
    window.location.hash = getActiveTaskAnchorHref(task);
    document.getElementById(getActiveTaskAnchorId(task))?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  row.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    navigateToTask();
  });
  row.addEventListener("keydown", (event) => {
    if (event.target !== row || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    navigateToTask();
  });

  const priorityCell = document.createElement("td");
  priorityCell.className = "compact-priority-cell";
  const dragHandle = document.createElement("button");
  dragHandle.className = "compact-drag-handle";
  dragHandle.type = "button";
  dragHandle.textContent = "⠿";
  dragHandle.title = "つかんで優先順位を並べ替え";
  dragHandle.setAttribute("aria-label", `${task.caseNumber}をつかんで並べ替え`);
  const priority = document.createElement("span");
  priority.className = "compact-task-priority";
  priority.textContent = String(index + 1);
  priority.title = `優先順位 ${index + 1}`;
  priority.setAttribute("aria-label", `優先順位 ${index + 1}`);
  priorityCell.append(dragHandle, priority);

  const caseCell = document.createElement("td");
  caseCell.className = "compact-case-cell";
  const caseNumber = document.createElement("span");
  caseNumber.className = "compact-task-case";
  caseNumber.textContent = task.caseNumber;
  caseCell.append(caseNumber);

  let dragArmed = false;
  row.draggable = true;
  dragHandle.addEventListener("pointerdown", () => {
    dragArmed = true;
  });
  dragHandle.addEventListener("pointerup", () => {
    dragArmed = false;
  });
  dragHandle.addEventListener("pointercancel", () => {
    dragArmed = false;
  });
  row.addEventListener("dragstart", (event) => {
    if (!dragArmed) {
      event.preventDefault();
      return;
    }
    dragArmed = false;
    draggedTaskId = task.id;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  });
  row.addEventListener("dragend", () => {
    dragArmed = false;
    draggedTaskId = null;
    row.classList.remove("is-dragging");
    clearDropIndicators();
  });
  row.addEventListener("dragover", (event) => {
    if (!draggedTaskId || draggedTaskId === task.id) return;
    event.preventDefault();
    clearDropIndicators();
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    row.classList.add(after ? "drag-after" : "drag-before");
  });
  row.addEventListener("drop", async (event) => {
    if (!draggedTaskId || draggedTaskId === task.id) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    clearDropIndicators();
    await reorderByDrop(draggedTaskId, task.id, after);
  });

  const titleCell = document.createElement("td");
  const title = document.createElement("span");
  title.className = "compact-task-title";
  title.textContent = ensureEmojiPresentation(task.title);
  title.title = task.title;
  titleCell.append(title);
  const taskParentCase = getParentCaseForTask(task);
  if (taskParentCase) {
    const parent = document.createElement("span");
    parent.className = "compact-task-parent";
    parent.textContent = `${taskParentCase.caseNumber} ${taskParentCase.name}`;
    titleCell.append(parent);
  }

  const linksCell = document.createElement("td");
  const links = document.createElement("div");
  links.className = "compact-task-links";
  if (task.links.length > 0) {
    links.append(...task.links.map((link) => createTaskLink(link, "table-link")));
  } else {
    const emptyLinks = document.createElement("span");
    emptyLinks.className = "compact-cell-empty";
    emptyLinks.textContent = "—";
    links.append(emptyLinks);
  }
  linksCell.append(links);

  const dueCell = document.createElement("td");
  const due = document.createElement("span");
  due.className = "compact-task-due";
  if (task.dueDate) {
    const dueState = getDueState(task.dueDate);
    due.dataset.state = dueState;
    due.textContent = `${formatDueDate(task.dueDate)} · ${formatDueDistance(task.dueDate)}`;
  } else {
    due.dataset.state = "none";
    due.textContent = "期限なし";
  }
  dueCell.append(due);

  row.append(priorityCell, caseCell, titleCell, linksCell, dueCell);
  return row;
}

function renderCompactTaskTable(activeTasks) {
  compactTaskTableBody.replaceChildren(
    ...activeTasks.map((task, index) => createCompactTaskRow(task, index))
  );
  compactTaskCount.textContent = `${activeTasks.length}件`;
  compactTaskEmpty.hidden = activeTasks.length > 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

async function copyActiveTasks() {
  const activeTasks = getActiveTasks();
  if (activeTasks.length === 0) {
    showToast("コピーする案件がありません");
    return;
  }

  try {
    await navigator.clipboard.writeText(formatTasksForCopy(activeTasks));
    showToast(`${activeTasks.length}件の案件をコピーしました`);
  } catch (_error) {
    showToast("案件をコピーできませんでした");
  }
}

function formatRestoreDate(exportedAt) {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

async function handleRestoreFile(event) {
  const [file] = event.target.files;
  restoreFileInput.value = "";
  if (!file) return;

  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("ファイルサイズは10MB以下にしてください");
    }

    const backup = validateBackup(JSON.parse(await file.text()));
    const restored = normalizeDataset(backup);
    const current = await loadTodoMemoDataset();
    const regression = assessRestoreRegression({
      backupExportedAt: backup.exportedAt,
      backupDataset: restored,
      currentUpdatedAt: loadTodoMemoDataUpdatedAt(),
      currentDataset: current
    });
    pendingRestore = { backup, fileName: file.name, regression };

    restoreFileName.textContent = file.name;
    restoreExportedAt.textContent = formatRestoreDate(regression.backupAt || backup.exportedAt);
    restoreCurrentUpdatedAt.textContent = regression.currentAt
      ? formatRestoreDate(regression.currentAt)
      : "不明";
    describeTaskCountInto(restoreTaskCount, restored.tasks);
    describeTaskCountInto(restoreCurrentTaskCount, current.tasks);
    restoreTagCount.textContent = `${restored.tags.length}件`;
    restoreCurrentTagCount.textContent = `${current.tags.length}件`;
    restoreParentCaseCount.textContent = `${restored.parentCases.length}件`;
    restoreCurrentParentCaseCount.textContent = `${current.parentCases.length}件`;

    applyRestoreRegressionWarning(regression);
    restoreDialog.showModal();
  } catch (error) {
    pendingRestore = null;
    showToast(error instanceof SyntaxError
      ? "JSONファイルを読み取れませんでした"
      : error.message);
  }
}

function describeTaskCountInto(element, taskList) {
  const active = taskList.filter((task) => !task.completed).length;
  element.textContent = `${taskList.length}件（未完了${active}・完了${taskList.length - active}）`;
}

// Restoring a file is the one action that can walk the data backwards on
// purpose, so an older file has to be acknowledged before it can be applied.
function applyRestoreRegressionWarning(regression) {
  const stale = regression.level === "danger";
  restoreAcknowledge.checked = false;
  restoreAcknowledgeRow.hidden = !stale;
  confirmRestoreButton.disabled = stale;
  confirmRestoreButton.classList.toggle("danger-button", stale);
  confirmRestoreButton.textContent = stale ? "古い内容で上書きする" : "この内容で復元";
  restoreDialog.classList.toggle("restore-dialog-danger", stale);

  if (stale) {
    restoreRegressionWarning.textContent =
      `このバックアップは、現在のデータより${formatElapsedJa(regression.staleMs)}古い内容です。`
      + `復元すると、その間の変更は失われます。`
      + (regression.shrink
        ? `件数も${regression.shrink.removed}件減ります。`
        : "");
  } else if (regression.level === "caution") {
    restoreRegressionWarning.textContent = regression.shrink.reason === "empty"
      ? "このバックアップには記録が1件もありません。復元すると現在の内容がすべて消えます。"
      : `このバックアップは現在より${regression.shrink.removed}件少ない内容です。`;
  } else if (!regression.comparable) {
    restoreRegressionWarning.textContent =
      "日時を読み取れないため、どちらが新しいか判断できません。件数を確認してください。";
  }
  restoreRegressionWarning.hidden = regression.level === "none" && regression.comparable;
}

function closeRestoreDialog() {
  pendingRestore = null;
  restoreDialog.classList.remove("restore-dialog-danger");
  restoreDialog.close();
}

async function confirmRestore() {
  if (!pendingRestore) return;
  if (pendingRestore.regression.level === "danger" && !restoreAcknowledge.checked) {
    showToast("古い内容で上書きすることを確認してください", "error");
    return;
  }
  confirmRestoreButton.disabled = true;

  try {
    // The cloud sync layer normalizes the same way, so a restored file and a
    // cloud document stay directly comparable.
    const restored = normalizeDataset(pendingRestore.backup);
    await saveTodoMemoDataset(restored);

    ({ tasks, tags, parentCases, holidays } = restored);
    const restoredCount = restored.tasks.length;
    pendingRestore = null;
    restoreDialog.classList.remove("restore-dialog-danger");
    restoreDialog.close();
    render();
    showToast(`${restoredCount}件のタスクを復元しました`);
  } catch (_error) {
    showToast("復元中にエラーが発生しました");
  } finally {
    confirmRestoreButton.disabled = false;
  }
}

function closeAllMenus(except = null) {
  document.querySelectorAll(".action-menu").forEach((menu) => {
    if (menu !== except) menu.hidden = true;
  });
}

function applyTagColor(element, tag) {
  element.style.setProperty("--tag-color", tag.color);
}

function createTaskLink(link, className = "card-link") {
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

function getParentCaseForTask(task) {
  return parentCases.find((parentCase) => parentCase.id === task.parentCaseId) || null;
}

function appendParentCaseLabel(container, parentCase) {
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
}

function appendParentCaseActions(container, parentCase) {
  const linkStatus = document.createElement(parentCase.url ? "a" : "span");
  linkStatus.className = "parent-case-link-status";
  linkStatus.dataset.state = parentCase.url ? "linked" : "none";
  linkStatus.textContent = parentCase.url ? "🔗 リンクあり" : "リンクなし";
  if (parentCase.url) {
    linkStatus.href = parentCase.url;
    linkStatus.target = "_blank";
    linkStatus.rel = "noopener noreferrer";
    linkStatus.title = `親案件リンクを開く: ${parentCase.url}`;
  }
  container.append(linkStatus);

  if (!parentCase.url) {
    const pasteButton = document.createElement("button");
    pasteButton.className = "parent-case-paste-link-button paste-link-button";
    pasteButton.type = "button";
    pasteButton.textContent = "📋 URLを取り込む";
    pasteButton.title = `${parentCase.name}にクリップボードのURLを取り込む`;
    pasteButton.addEventListener("click", async () => {
      pasteButton.disabled = true;
      try {
        const pastedLinks = extractTaskLinks(await navigator.clipboard.readText())
          .map(normalizeParentCaseUrl)
          .filter(Boolean);
        if (pastedLinks.length === 0) {
          showToast("クリップボードにURLが見つかりません");
          return;
        }
        parentCase.url = pastedLinks[0];
        parentCases = await saveParentCases(parentCases);
        render();
        showToast("親案件にURLを取り込みました");
      } catch (_error) {
        showToast("クリップボードを読み取れませんでした");
      } finally {
        pasteButton.disabled = false;
      }
    });
    container.append(pasteButton);
  }

  const copyButton = document.createElement("button");
  copyButton.className = "parent-case-copy-button";
  copyButton.type = "button";
  copyButton.textContent = "親案件COPY";
  copyButton.title = `${parentCase.name}_${parentCase.caseNumber}をコピー`;
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatParentCaseForCopy(parentCase));
      showToast("親案件をコピーしました");
    } catch (_error) {
      showToast("親案件をコピーできませんでした");
    }
  });
  container.append(copyButton);
}

function fillParentCaseElement(element, task) {
  const parentCase = getParentCaseForTask(task);
  element.replaceChildren();
  if (!parentCase) {
    element.hidden = true;
    return;
  }

  const parentJumpLink = document.createElement("a");
  parentJumpLink.href = `#${encodeURIComponent(getParentCaseAnchorId(parentCase))}`;
  parentJumpLink.title = `親案件「${parentCase.name}」へ移動`;
  appendParentCaseLabel(parentJumpLink, parentCase);
  parentJumpLink.addEventListener("click", (event) => {
    event.preventDefault();
    if (taskDetailDialog.open) closeTaskDetail();
    setParentCaseViewMode("group");
    jumpToElement(document.getElementById(getParentCaseAnchorId(parentCase)));
  });
  element.append(parentJumpLink);
  appendParentCaseActions(element, parentCase);
  element.hidden = false;
}

function fillTaskCopy(card, task, { showEmptyContent = false } = {}) {
  card.querySelector(".card-case-number").textContent = `案件番号 ${task.caseNumber}`;
  fillParentCaseElement(card.querySelector(".card-parent-case"), task);
  card.querySelector(".task-title-text, h3").textContent = ensureEmojiPresentation(task.title);
  const cardContent = card.querySelector(".card-content");
  const lineCount = cardContent.previousElementSibling?.classList.contains("content-line-count")
    ? cardContent.previousElementSibling
    : document.createElement("span");
  lineCount.className = "content-line-count";
  lineCount.textContent = `内容 ${countContentLines(task.content)}行`;
  if (!lineCount.isConnected) cardContent.before(lineCount);
  const hasContent = Boolean(task.content.trim());
  cardContent.classList.toggle("is-empty", showEmptyContent && !hasContent);
  if (hasContent) {
    renderMarkdown(cardContent, task.content);
  } else {
    cardContent.replaceChildren();
  }
  cardContent.hidden = !hasContent && !showEmptyContent;
  const endMarker = card.querySelector(".card-content-end-marker");
  if (endMarker) {
    endMarker.classList.remove("is-continued");
    endMarker.querySelector("span").textContent = "END";
    endMarker.setAttribute("aria-label", "内容はここまでです");
  }

  const cardTags = card.querySelector(".card-tags");
  const selectedTags = tags.filter((tag) => task.tagIds.includes(tag.id));
  cardTags.replaceChildren(...selectedTags.map((tag) => {
    const chip = document.createElement("span");
    chip.className = "card-tag";
    chip.textContent = ensureEmojiPresentation(tag.name);
    applyTagColor(chip, tag);
    return chip;
  }));
  cardTags.hidden = selectedTags.length === 0;
  renderLinks(card.querySelector(".card-links"), task.links);

  const due = card.querySelector(".card-due");
  if (task.dueDate) {
    const dueState = getDueState(task.dueDate);
    const prefix = dueState === "overdue"
      ? "期限超過"
      : dueState === "today"
        ? "今日まで"
        : "期限";
    due.textContent = `${prefix} · ${formatDueDate(task.dueDate)} · ${formatDueDistance(task.dueDate)}`;
    due.dataset.state = dueState;
    due.hidden = false;
  } else {
    due.textContent = "期限なし";
    due.dataset.state = "none";
    due.hidden = false;
  }
}

function updateCardContentEndMarkers() {
  document.querySelectorAll(".task-card").forEach((card) => {
    const content = card.querySelector(".card-content");
    const marker = card.querySelector(".card-content-end-marker");
    if (!content || !marker) return;

    const isClipped = !content.hidden && content.scrollHeight > content.clientHeight + 1;
    marker.classList.toggle("is-continued", isClipped);
    marker.querySelector("span").textContent = isClipped
      ? "▼ 以下に続きます（クリックで全文表示）"
      : "END";
    marker.setAttribute("aria-label", isClipped
      ? "内容は以下に続きます。カードをクリックすると全文を表示します"
      : "内容はここまでです");
  });
}

function createTagOption(tag, selectedIds) {
  const label = document.createElement("label");
  label.className = "tag-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = tag.id;
  input.checked = selectedIds.includes(tag.id);

  const text = document.createElement("span");
  text.textContent = ensureEmojiPresentation(tag.name);
  applyTagColor(text, tag);
  label.append(input, text);
  return label;
}

function renderTaskTagOptions(selectedIds = []) {
  taskTagOptions.replaceChildren(...tags.map((tag) => createTagOption(tag, selectedIds)));
  taskTagsField.hidden = tags.length === 0;
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
  linkInputs.replaceChildren(...Array.from({ length: TODO_MEMO_MAX_LINKS }, (_, index) => {
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
    [...linkInputs.querySelectorAll(".link-url-input")].map((input) => input.value)
  );
}

function setLinkMessage(message, state = "") {
  linkMessage.textContent = message;
  linkMessage.dataset.state = state;
}

async function pasteLinksFromClipboard() {
  pasteLinkButton.disabled = true;
  try {
    const pastedLinks = extractTaskLinks(await navigator.clipboard.readText());
    if (pastedLinks.length === 0) {
      setLinkMessage("クリップボードにURLが見つかりませんでした。", "error");
      return;
    }

    const inputs = [...linkInputs.querySelectorAll(".link-url-input")];
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
    markTaskEditorDirty();
  } catch (_error) {
    setLinkMessage("クリップボードを読み取れませんでした。", "error");
  } finally {
    pasteLinkButton.disabled = false;
  }
}

function updateDueDateClearButton() {
  clearDueDateButton.hidden = !dueDateInput.value;
}

function renderTagSettings() {
  tagCount.textContent = `${tags.length}件`;
  tagEmpty.hidden = tags.length > 0;
  tagList.replaceChildren(...tags.map((tag) => {
    const chip = document.createElement("div");
    chip.className = "managed-tag";
    applyTagColor(chip, tag);

    const color = document.createElement("input");
    color.className = "tag-color-input";
    color.type = "color";
    color.value = tag.color;
    color.setAttribute("aria-label", `「${tag.name}」タグの色`);
    color.title = "タグの色を変更";
    color.addEventListener("input", () => {
      chip.style.setProperty("--tag-color", color.value);
    });
    color.addEventListener("change", () => updateTag(tag.id, { color: color.value }));

    const name = document.createElement("input");
    name.className = "tag-name-input";
    name.type = "text";
    name.maxLength = 20;
    name.value = tag.name;
    name.setAttribute("aria-label", `「${tag.name}」タグの名前`);
    name.title = "タグ名を編集";
    name.addEventListener("change", () => updateTag(tag.id, { name: name.value }));
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        name.blur();
      }
    });

    const remove = document.createElement("button");
    remove.className = "remove-tag-button";
    remove.type = "button";
    remove.setAttribute("aria-label", `「${tag.name}」タグを削除`);
    remove.title = "タグを削除";
    remove.textContent = "×";
    remove.addEventListener("click", () => removeTag(tag));

    chip.append(color, name, remove);
    return chip;
  }));
}

async function updateTag(tagId, changes) {
  const target = tags.find((tag) => tag.id === tagId);
  if (!target) return;

  const nextName = changes.name === undefined ? target.name : changes.name.trim();
  if (!nextName) {
    showToast("タグ名を入力してください");
    renderTagSettings();
    return;
  }
  if (tags.some((tag) => tag.id !== tagId && tag.name.toLocaleLowerCase("ja") === nextName.toLocaleLowerCase("ja"))) {
    showToast("同じ名前のタグがあります");
    renderTagSettings();
    return;
  }

  target.name = nextName;
  if (changes.color && /^#[0-9a-f]{6}$/i.test(changes.color)) {
    target.color = changes.color.toLowerCase();
  }
  tags = await saveTags(tags);
  render();
  showToast("タグを更新しました");
}

function attachMenu(card, task) {
  const moreButton = card.querySelector(".more-button");
  const menu = card.querySelector(".action-menu");

  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = menu.hidden;
    closeAllMenus(menu);
    menu.hidden = !shouldOpen;
  });

  card.querySelector(".delete-button").addEventListener("click", async () => {
    closeAllMenus();
    if (!confirm(`「${task.title}」を削除しますか？`)) return;
    tasks = tasks.filter((item) => item.id !== task.id);
    tasks = await saveTasks(tasks);
    render();
    showToast("タスクを削除しました");
  });
}

function isInteractiveCardTarget(target) {
  return target.closest("a, button, input, textarea, select, label, [contenteditable]");
}

function attachCardOpenActions(card, task, { editOnDoubleClick = false } = {}) {
  let detailOpenTimer = null;

  card.addEventListener("click", (event) => {
    if (isInteractiveCardTarget(event.target)) return;
    clearTimeout(detailOpenTimer);
    detailOpenTimer = setTimeout(() => {
      openTaskDetail(task);
      detailOpenTimer = null;
    }, 220);
  });

  if (!editOnDoubleClick) return;

  card.addEventListener("dblclick", (event) => {
    if (isInteractiveCardTarget(event.target)) return;
    clearTimeout(detailOpenTimer);
    detailOpenTimer = null;
    openTaskDialog(task);
  });
}

function openTaskDetail(task) {
  detailTaskId = task.id;
  const detailCopy = taskDetailDialog.querySelector(".task-detail-body");
  fillTaskCopy(detailCopy, task, { showEmptyContent: true });
  taskDetailDialog.showModal();
}

function closeTaskDetail() {
  detailTaskId = null;
  taskDetailDialog.close();
}

function attachTaskCopy(card, task) {
  card.querySelector(".copy-task-button").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatTaskForCopy(task));
      showToast("案件をコピーしました");
    } catch (_error) {
      showToast("案件をコピーできませんでした");
    }
  });
  card.querySelector(".copy-task-heading-button").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(formatTaskHeadingForCopy(task));
      showToast("案件番号とタイトルをコピーしました");
    } catch (_error) {
      showToast("案件番号とタイトルをコピーできませんでした");
    }
  });
}

function attachTaskLinkPaste(card, task) {
  const button = card.querySelector(".card-paste-link-button");
  button.addEventListener("click", async () => {
    if (task.links.length >= TODO_MEMO_MAX_LINKS) {
      showToast("リンクは3件までです");
      return;
    }

    button.disabled = true;
    try {
      const pastedLinks = extractTaskLinks(await navigator.clipboard.readText());
      if (pastedLinks.length === 0) {
        showToast("クリップボードにURLが見つかりません");
        return;
      }

      const links = [...task.links];
      const existing = new Set(links);
      pastedLinks.forEach((link) => {
        if (links.length >= TODO_MEMO_MAX_LINKS || existing.has(link)) return;
        links.push(link);
        existing.add(link);
      });
      const added = links.length - task.links.length;
      if (added === 0) {
        showToast("同じリンクがすでに登録されています");
        return;
      }

      task.links = links;
      tasks = await saveTasks(tasks);
      render();
      showToast(`${added}件のリンクを追加しました`);
    } catch (_error) {
      showToast("クリップボードを読み取れませんでした");
    } finally {
      button.disabled = false;
    }
  });
}

function createActiveCard(task, index, total) {
  const card = document.querySelector("#activeTaskTemplate").content.firstElementChild.cloneNode(true);
  card.dataset.taskId = task.id;
  card.id = getActiveTaskAnchorId(task);
  const priorityNumber = card.querySelector(".card-priority-number");
  priorityNumber.textContent = String(index + 1);
  priorityNumber.title = `優先順位 ${index + 1}`;
  priorityNumber.setAttribute("aria-label", `優先順位 ${index + 1}`);
  if (index === 0) {
    card.classList.add("is-current");
    const currentBadge = document.createElement("span");
    currentBadge.className = "current-task-badge";
    currentBadge.textContent = "今すること";
    card.querySelector(".task-copy").prepend(currentBadge);
    card.setAttribute("aria-label", `今すること: ${task.title}`);
  }
  fillTaskCopy(card, task, { showEmptyContent: true });
  attachMenu(card, task);
  attachCardOpenActions(card, task, { editOnDoubleClick: true });
  attachTaskCopy(card, task);
  attachTaskLinkPaste(card, task);

  card.querySelector(".complete-toggle").addEventListener("click", () => setCompleted(task.id, true));
  card.querySelector(".quick-edit-button").addEventListener("click", () => openTaskDialog(task));
  card.querySelector(".edit-button").addEventListener("click", () => openTaskDialog(task));

  const moveUp = card.querySelector(".move-up");
  const moveDown = card.querySelector(".move-down");
  moveUp.disabled = index === 0;
  moveDown.disabled = index === total - 1;
  moveUp.addEventListener("click", () => moveTask(task.id, -1));
  moveDown.addEventListener("click", () => moveTask(task.id, 1));

  card.addEventListener("dragstart", (event) => {
    draggedTaskId = task.id;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("is-dragging");
    clearDropIndicators();
  });

  card.addEventListener("dragover", (event) => {
    if (!draggedTaskId || draggedTaskId === task.id) return;
    event.preventDefault();
    clearDropIndicators();
    const rect = card.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    card.classList.add(after ? "drag-after" : "drag-before");
  });

  card.addEventListener("drop", async (event) => {
    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    await reorderByDrop(draggedTaskId, task.id, after);
  });

  return card;
}

function createCompletedCard(task) {
  const card = document.querySelector("#completedTaskTemplate").content.firstElementChild.cloneNode(true);
  card.dataset.taskId = task.id;
  card.id = getCompletedTaskAnchorId(task);
  fillTaskCopy(card, task);
  card.querySelector(".card-completed-at").textContent = formatCompletedAt(task.completedAt);
  attachMenu(card, task);
  attachCardOpenActions(card, task);
  attachTaskCopy(card, task);
  attachTaskLinkPaste(card, task);
  card.querySelector(".complete-toggle").addEventListener("click", () => setCompleted(task.id, false));
  card.querySelector(".restore-button").addEventListener("click", () => setCompleted(task.id, false));
  return card;
}

function renderParentCaseSettings() {
  parentCaseCount.textContent = `${parentCases.length}件`;
  parentCaseEmpty.hidden = parentCases.length > 0;
  parentCaseList.replaceChildren(...parentCases.map((parentCase) => {
    const row = document.createElement("div");
    row.className = "parent-case-row";

    const number = document.createElement("strong");
    number.className = "parent-case-number";
    number.textContent = parentCase.caseNumber;

    const name = document.createElement("input");
    name.className = "parent-case-name-input";
    name.type = "text";
    name.maxLength = 100;
    name.value = parentCase.name;
    name.setAttribute("aria-label", `${parentCase.caseNumber}の親案件名`);

    const url = document.createElement("input");
    url.className = "parent-case-url-input";
    url.type = "url";
    url.inputMode = "url";
    url.value = parentCase.url;
    url.placeholder = "https://…";
    url.setAttribute("aria-label", `${parentCase.caseNumber}のURL`);

    const usedCount = document.createElement("span");
    usedCount.className = "parent-case-used-count";
    usedCount.textContent =
      `${tasks.filter((task) => task.parentCaseId === parentCase.id).length}件`;

    const saveParentCaseEdits = async () => {
      const nextName = name.value.trim();
      const rawUrl = url.value.trim();
      const nextUrl = normalizeParentCaseUrl(rawUrl);
      if (!nextName) {
        showToast("親案件名を入力してください");
        name.focus();
        return false;
      }
      if (rawUrl && !nextUrl) {
        showToast("親案件URLはhttp://またはhttps://で入力してください");
        url.focus();
        return false;
      }
      if (
        parentCases.some((item) =>
          item.id !== parentCase.id &&
          item.name.toLocaleLowerCase("ja") === nextName.toLocaleLowerCase("ja")
        )
      ) {
        showToast("同じ名前の親案件があります");
        name.focus();
        return false;
      }
      if (parentCase.name === nextName && parentCase.url === nextUrl) return true;
      parentCase.name = nextName;
      parentCase.url = nextUrl;
      parentCases = await saveParentCases(parentCases);
      render();
      showToast("親案件を更新しました");
      return true;
    };

    [name, url].forEach((input) => {
      input.addEventListener("input", () => {
        row.dataset.dirty = "true";
      });
      input.addEventListener("change", saveParentCaseEdits);
    });
    row.saveEdits = saveParentCaseEdits;

    const remove = document.createElement("button");
    remove.className = "parent-case-remove danger-text";
    remove.type = "button";
    remove.textContent = "削除";
    remove.addEventListener("click", async () => {
      const used = tasks.filter((task) => task.parentCaseId === parentCase.id).length;
      const message = used > 0
        ? `${parentCase.caseNumber}は${used}件の案件で使用中です。親案件を削除し、関連付けを解除しますか？`
        : `${parentCase.caseNumber} ${parentCase.name}を削除しますか？`;
      if (!confirm(message)) return;
      parentCases = parentCases.filter((item) => item.id !== parentCase.id);
      tasks = tasks.map((task) => task.parentCaseId === parentCase.id
        ? { ...task, parentCaseId: "" }
        : task);
      [parentCases, tasks] = await Promise.all([
        saveParentCases(parentCases),
        saveTasks(tasks)
      ]);
      render();
      showToast("親案件を削除しました");
    });

    row.append(number, name, url, usedCount, remove);
    return row;
  }));
}

function createParentCaseTaskGroup(parentCase, groupedTasks, priorityByTaskId) {
  const group = document.createElement("article");
  group.className = "parent-task-group";
  if (parentCase) group.id = getParentCaseAnchorId(parentCase);
  if (!parentCase) group.classList.add("is-unassigned");

  const header = document.createElement("div");
  header.className = "parent-task-group-header";

  const identity = document.createElement("div");
  identity.className = "parent-task-group-identity";
  if (parentCase) {
    appendParentCaseLabel(identity, parentCase);
    appendParentCaseActions(identity, parentCase);
  } else {
    const number = document.createElement("span");
    number.className = "parent-task-group-number";
    number.textContent = "親案件未設定";

    const name = document.createElement("h3");
    name.textContent = "親案件なし";
    identity.append(number, name);
  }

  const summary = document.createElement("span");
  summary.className = "parent-task-group-summary";
  summary.textContent = `${groupedTasks.length}件`;

  header.append(identity);
  if (parentCase) {
    const ideaButton = document.createElement("button");
    ideaButton.className = "parent-task-group-idea-button";
    ideaButton.type = "button";
    ideaButton.dataset.state = parentCase.ideaMemos.length > 0 ? "has-memos" : "empty";
    ideaButton.textContent = `💡 アイデアメモ ${parentCase.ideaMemos.length}件`;
    const ideaPreview = formatParentIdeaMemoPreview(parentCase.ideaMemos);
    ideaButton.title = ideaPreview || `${parentCase.name}のアイデアメモを表示`;
    ideaButton.setAttribute("aria-haspopup", "dialog");
    ideaButton.setAttribute("aria-controls", "parentIdeaDialog");
    ideaButton.setAttribute(
      "aria-label",
      `${parentCase.name}のアイデアメモ ${parentCase.ideaMemos.length}件を表示`
    );
    ideaButton.addEventListener("click", () => openParentIdeaDialog(parentCase.id));
    header.append(ideaButton);
  }
  header.append(summary);
  if (parentCase) {
    const addTaskButton = document.createElement("button");
    addTaskButton.className = "parent-task-group-add-task";
    addTaskButton.type = "button";
    addTaskButton.textContent = "＋ タスク追加";
    addTaskButton.title = `${parentCase.caseNumber}を親案件にして新しいタスクを追加`;
    addTaskButton.addEventListener("click", () => openTaskDialog(null, parentCase.id));
    header.append(addTaskButton);
  }
  group.append(header);

  if (groupedTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "parent-task-group-empty";
    empty.textContent = "この親案件に紐づく案件はありません。";
    group.append(empty);
    return group;
  }

  const list = document.createElement("ul");
  list.className = "parent-task-group-list";
  groupedTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "parent-task-group-list-item";
    const link = document.createElement("a");
    link.className = "parent-task-item";
    link.href = getTaskAnchorHref(task);
    link.title = `${task.caseNumber} ${task.title}の詳細カードへ移動`;

    const priority = document.createElement("span");
    priority.className = "parent-task-item-priority";
    priority.textContent = String(priorityByTaskId.get(task.id) || "");
    priority.title = `優先順位 ${priority.textContent}`;
    priority.setAttribute("aria-label", `優先順位 ${priority.textContent}`);

    const caseNumber = document.createElement("span");
    caseNumber.className = "parent-task-item-case";
    caseNumber.textContent = task.caseNumber;

    const title = document.createElement("span");
    title.className = "parent-task-item-title";
    title.textContent = ensureEmojiPresentation(task.title);

    const due = document.createElement("time");
    due.className = "parent-task-item-due";
    if (task.dueDate) {
      due.dateTime = task.dueDate;
      due.dataset.state = getDueState(task.dueDate);
      due.textContent = `${formatDueDate(task.dueDate)} · ${formatDueDistance(task.dueDate)}`;
      due.title = `期限 ${due.textContent}`;
    } else {
      due.hidden = true;
    }

    link.append(priority, caseNumber, title, due);

    const taskLinks = document.createElement("div");
    taskLinks.className = "parent-task-item-links";
    taskLinks.setAttribute("aria-label", `${task.caseNumber}の関連リンク`);
    if (task.links.length > 0) {
      taskLinks.append(...task.links.map((taskLink) =>
        createTaskLink(taskLink, "table-link parent-task-link")
      ));
    } else {
      const emptyLinks = document.createElement("span");
      emptyLinks.className = "parent-task-item-links-empty";
      emptyLinks.textContent = "—";
      emptyLinks.setAttribute("aria-label", "関連リンクなし");
      taskLinks.append(emptyLinks);
    }

    const editButton = document.createElement("button");
    editButton.className = "parent-task-item-edit";
    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.title = `${task.caseNumber} ${task.title}を編集`;
    editButton.setAttribute("aria-label", `${task.caseNumber} ${task.title}を編集`);
    editButton.addEventListener("click", () => openTaskDialog(task));

    item.append(link, taskLinks, editButton);
    list.append(item);
  });
  group.append(list);
  return group;
}

function renderParentIdeaDialog() {
  const parentCase = parentCases.find((item) => item.id === ideaMemoParentCaseId);
  if (!parentCase) {
    if (parentIdeaDialog.open) parentIdeaDialog.close();
    return;
  }
  parentIdeaDialogCaseNumber.textContent = parentCase.caseNumber;
  parentIdeaDialogTitle.textContent = ensureEmojiPresentation(parentCase.name);
  parentIdeaDialogCount.textContent = `${parentCase.ideaMemos.length}件`;
  parentIdeaDialogEmpty.hidden = parentCase.ideaMemos.length > 0;
  parentIdeaDialogInput.disabled = parentCase.ideaMemos.length >= TODO_MEMO_MAX_PARENT_IDEA_MEMOS;

  parentIdeaDialogList.replaceChildren(...parentCase.ideaMemos.map((memo, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "parent-idea-dialog-item-number";
    number.textContent = `💡 ${index + 1}`;
    number.setAttribute("aria-hidden", "true");
    const input = document.createElement("input");
    input.className = "parent-idea-dialog-edit-input";
    input.type = "text";
    input.maxLength = 500;
    input.value = memo.text;
    input.dataset.memoId = memo.id;
    input.setAttribute("aria-label", `アイデアメモ ${index + 1}を編集`);
    input.addEventListener("input", () => {
      input.dataset.dirty = "true";
    });
    input.addEventListener("blur", persistOpenParentIdeaEdits);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
    const moveActions = document.createElement("span");
    moveActions.className = "parent-idea-dialog-move-actions";
    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.textContent = "↑";
    moveUp.title = `アイデアメモ ${index + 1}を上へ移動`;
    moveUp.setAttribute("aria-label", moveUp.title);
    moveUp.disabled = index === 0;
    moveUp.addEventListener("click", () => reorderParentIdeaMemo(memo.id, -1));
    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.textContent = "↓";
    moveDown.title = `アイデアメモ ${index + 1}を下へ移動`;
    moveDown.setAttribute("aria-label", moveDown.title);
    moveDown.disabled = index === parentCase.ideaMemos.length - 1;
    moveDown.addEventListener("click", () => reorderParentIdeaMemo(memo.id, 1));
    moveActions.append(moveUp, moveDown);
    const remove = document.createElement("button");
    remove.className = "parent-idea-dialog-delete";
    remove.type = "button";
    remove.textContent = "削除";
    remove.title = `アイデアメモ「${memo.text}」を削除`;
    remove.dataset.memoId = memo.id;
    item.append(number, input, moveActions, remove);
    return item;
  }));
}

function applyOpenParentIdeaEdits() {
  const parentCase = parentCases.find((item) => item.id === ideaMemoParentCaseId);
  if (!parentCase) return false;
  let changed = false;
  parentIdeaDialogList.querySelectorAll(".parent-idea-dialog-edit-input").forEach((input) => {
    const memo = parentCase.ideaMemos.find((item) => item.id === input.dataset.memoId);
    const nextText = input.value.trim();
    if (!memo || !nextText || input.dataset.dirty !== "true") return;
    memo.text = nextText;
    delete input.dataset.dirty;
    changed = true;
  });
  return changed;
}

function queueParentIdeaSave(message) {
  const revision = ++parentIdeaSaveRevision;
  const snapshot = parentCases.map((parentCase) => ({
    ...parentCase,
    ideaMemos: parentCase.ideaMemos.map((memo) => ({ ...memo }))
  }));
  parentIdeaSavePromise = parentIdeaSavePromise
    .catch(() => undefined)
    .then(async () => {
      const savedParentCases = await saveParentCases(snapshot);
      if (revision === parentIdeaSaveRevision) parentCases = savedParentCases;
      if (message) showToast(message);
    });
  return parentIdeaSavePromise;
}

function persistOpenParentIdeaEdits() {
  if (!applyOpenParentIdeaEdits()) return;
  queueParentIdeaSave("アイデアメモを自動保存しました");
}

function reorderParentIdeaMemo(memoId, direction) {
  applyOpenParentIdeaEdits();
  parentCases = moveParentIdeaMemo(parentCases, ideaMemoParentCaseId, memoId, direction);
  render();
  renderParentIdeaDialog();
  queueParentIdeaSave("アイデアメモの順番を変更しました");
}

function openParentIdeaDialog(parentCaseId) {
  ideaMemoParentCaseId = parentCaseId;
  parentIdeaDialogInput.value = "";
  renderParentIdeaDialog();
  parentIdeaDialog.showModal();
  parentIdeaDialogInput.focus();
}

function closeParentIdeaDialog() {
  persistOpenParentIdeaEdits();
  ideaMemoParentCaseId = null;
  parentIdeaDialog.close();
}

function renderParentCaseGroups() {
  const activeTasks = tasks.filter((task) => !task.completed);
  const priorityByTaskId = new Map(
    activeTasks.map((task, index) => [task.id, index + 1])
  );
  parentCaseGroups.replaceChildren(
    ...groupTasksByParentCase(parentCases, activeTasks).map(({ parentCase, tasks: groupedTasks }) =>
      createParentCaseTaskGroup(parentCase, groupedTasks, priorityByTaskId)
    )
  );
  removeRetiredInlineIdeaMemoEditors();
}

function setParentCaseViewMode(mode) {
  parentCaseViewMode = mode === "group" ? "group" : "manage";
  const showGroups = parentCaseViewMode === "group";
  parentCaseManageView.hidden = showGroups;
  parentCaseGroupView.hidden = !showGroups;
  parentCaseManageModeButton.classList.toggle("is-active", !showGroups);
  parentCaseGroupModeButton.classList.toggle("is-active", showGroups);
  parentCaseManageModeButton.setAttribute("aria-selected", String(!showGroups));
  parentCaseGroupModeButton.setAttribute("aria-selected", String(showGroups));
}

async function showParentCaseGroups() {
  const dirtyRow = parentCaseList.querySelector('.parent-case-row[data-dirty="true"]');
  if (dirtyRow && !(await dirtyRow.saveEdits())) return;
  setParentCaseViewMode("group");
}

function setActiveListCollapsed(collapsed) {
  const activeTaskCount = getActiveTasks().length;
  activeListCollapsed = activeTaskCount > 0 && Boolean(collapsed);
  const hiddenCount = activeListCollapsed ? Math.max(activeTaskCount - 1, 0) : 0;
  activeList.hidden = false;
  activeList.classList.toggle("is-collapsed", activeListCollapsed);
  activeEmpty.hidden = activeTaskCount > 0;
  activeTaskSection.classList.toggle("is-collapsed", activeListCollapsed);
  activeCollapsedNotice.hidden = !activeListCollapsed || hiddenCount === 0;
  activeCollapsedCount.textContent = `${hiddenCount}件`;
  toggleActiveListButton.disabled = activeTaskCount === 0;
  toggleActiveListButton.dataset.state = activeListCollapsed ? "collapsed" : "expanded";
  const toggleLabel = activeListCollapsed ? "表示する" : "折りたたむ";
  toggleActiveListButton.querySelector(".collapse-active-label").textContent = toggleLabel;
  toggleActiveListButton.setAttribute("aria-label", `すること一覧を${toggleLabel}`);
  toggleActiveListButton.title = `すること一覧を${toggleLabel}`;
  toggleActiveListButton.setAttribute("aria-expanded", String(!activeListCollapsed));
}

function render() {
  const active = getActiveTasks();
  const completed = getCompletedTasks();

  activeList.replaceChildren(...active.map((task, index) => createActiveCard(task, index, active.length)));
  renderDeadlineCalendar(active);
  renderCaseJumpOptions(active);
  renderCompactTaskTable(active);
  completedList.replaceChildren(...completed.map(createCompletedCard));
  updateCardContentEndMarkers();
  renderParentCaseGroups();

  activeCount.textContent = `${active.length}件`;
  completedCount.textContent = `${completed.length}件`;
  navCompactTaskCount.textContent = `${active.length}件`;
  navActiveCount.textContent = `${active.length}件`;
  navParentCaseCount.textContent = `${parentCases.length}件`;
  navTagCount.textContent = `${tags.length}件`;
  navCompletedCount.textContent = `${completed.length}件`;
  copyActiveTasksButton.disabled = active.length === 0;
  activeEmpty.hidden = active.length > 0;
  completedEmpty.hidden = completed.length > 0;
  clearCompletedButton.hidden = getDeletableCompletedTasks().length === 0;
  renderParentCaseSettings();
  setParentCaseViewMode(parentCaseViewMode);
  setActiveListCollapsed(activeListCollapsed);
  renderTagSettings();
}

function clearDropIndicators() {
  document.querySelectorAll(".drag-before, .drag-after").forEach((card) => {
    card.classList.remove("drag-before", "drag-after");
  });
}

async function moveTask(taskId, direction) {
  const active = getActiveTasks();
  const completed = tasks.filter((task) => task.completed);
  const currentIndex = active.findIndex((task) => task.id === taskId);
  const destination = currentIndex + direction;

  if (currentIndex < 0 || destination < 0 || destination >= active.length) return;

  [active[currentIndex], active[destination]] = [active[destination], active[currentIndex]];
  tasks = await saveTasks([...active, ...completed]);
  render();
}

async function reorderByDrop(sourceId, targetId, after) {
  if (!sourceId || sourceId === targetId) return;

  const active = getActiveTasks();
  const completed = tasks.filter((task) => task.completed);
  const sourceIndex = active.findIndex((task) => task.id === sourceId);
  if (sourceIndex < 0) return;

  const [source] = active.splice(sourceIndex, 1);
  let targetIndex = active.findIndex((task) => task.id === targetId);
  if (targetIndex < 0) return;
  if (after) targetIndex += 1;
  active.splice(targetIndex, 0, source);

  tasks = await saveTasks([...active, ...completed]);
  draggedTaskId = null;
  render();
  showToast("優先順位を変更しました");
}

async function setCompleted(taskId, completed) {
  const target = tasks.find((task) => task.id === taskId);
  if (!target) return;

  target.completed = completed;
  target.completedAt = completed ? new Date().toISOString() : null;

  const active = tasks.filter((task) => !task.completed);
  const done = tasks.filter((task) => task.completed);
  tasks = await saveTasks([...active, ...done]);
  render();
  showToast(completed ? "完了にしました" : "することに戻しました");
}

function renderParentCaseOptions(selectedId = "") {
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "親案件なし";
  parentCaseSelect.replaceChildren(
    emptyOption,
    ...sortParentCasesByNumberDescending(parentCases).map((parentCase) => {
      const option = document.createElement("option");
      option.value = parentCase.id;
      option.textContent = `${parentCase.caseNumber}｜${parentCase.name}`;
      return option;
    })
  );
  parentCaseSelect.value = parentCases.some((parentCase) => parentCase.id === selectedId)
    ? selectedId
    : "";
}

function renderPriorityOptions(task = null) {
  const active = getActiveTasks();
  const currentIndex = task ? active.findIndex((item) => item.id === task.id) : -1;
  const optionCount = active.length + (currentIndex < 0 ? 1 : 0);
  prioritySelect.replaceChildren(
    ...Array.from({ length: optionCount }, (_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = `${index + 1}番`;
      return option;
    })
  );
  prioritySelect.value = String(currentIndex >= 0 ? currentIndex + 1 : optionCount);
  prioritySelect.disabled = Boolean(task?.completed);
}

function openTaskDialog(task = null, initialParentCaseId = "") {
  closeAllMenus();
  taskForm.reset();
  titleError.textContent = "";
  titleInput.classList.remove("is-invalid");

  if (task) {
    dialogTitle.textContent = "タスクを編集";
    dialogCaseNumber.textContent = `案件番号 ${task.caseNumber}`;
    dialogCaseNumber.hidden = false;
    taskIdInput.value = task.id;
    titleInput.value = task.title;
    contentInput.value = task.content;
    dueDateInput.value = task.dueDate;
    renderParentCaseOptions(task.parentCaseId);
    renderPriorityOptions(task);
    renderTaskTagOptions(task.tagIds);
    renderLinkInputs(task.links);
    taskAutoSaveStatus.textContent = "保存済み";
    taskAutoSaveStatus.dataset.state = "saved";
    taskAutoSaveStatus.hidden = true;
    cancelButton.textContent = "閉じる";
    deleteTaskButton.hidden = false;
  } else {
    dialogTitle.textContent = "新しいタスク";
    dialogCaseNumber.textContent = "案件番号は保存時に自動採番します";
    dialogCaseNumber.hidden = false;
    taskIdInput.value = "";
    renderParentCaseOptions(initialParentCaseId);
    renderPriorityOptions();
    renderTaskTagOptions();
    renderLinkInputs();
    taskAutoSaveStatus.textContent = "タイトル入力後に自動保存します";
    taskAutoSaveStatus.dataset.state = "saved";
    taskAutoSaveStatus.hidden = true;
    cancelButton.textContent = "閉じる";
    deleteTaskButton.hidden = true;
  }

  renderContentSelectionHighlights();
  updateDueDateClearButton();
  setLinkMessage("URLまたはメールアドレスを登録できます。");
  taskDialog.showModal();
  requestAnimationFrame(() => {
    resizeContentInput();
    titleInput.focus();
  });
}

async function closeTaskDialog() {
  if (titleInput.value.trim()) await persistEditedTask();
  taskDialog.close();
}

async function deleteTaskFromEditor() {
  const task = tasks.find((item) => item.id === taskIdInput.value);
  if (!task || !confirm(`「${task.title}」を削除しますか？\nこの操作は取り消せません。`)) return;

  deleteTaskButton.disabled = true;
  try {
    await taskAutoSavePromise.catch(() => undefined);
    tasks = await saveTasks(tasks.filter((item) => item.id !== task.id));
    taskDialog.close();
    render();
    showToast("タスクを削除しました");
  } finally {
    deleteTaskButton.disabled = false;
  }
}

function collectTaskFormValues(task) {
  task.title = titleInput.value.trim();
  task.content = contentInput.value;
  task.dueDate = dueDateInput.value;
  task.parentCaseId = parentCaseSelect.value;
  task.tagIds = [...taskTagOptions.querySelectorAll("input:checked")]
    .map((input) => input.value);
  task.links = collectLinkInputValues();
}

async function persistEditedTask() {
  const title = titleInput.value.trim();
  if (!title) {
    titleError.textContent = "タイトルを入力してください";
    titleInput.classList.add("is-invalid");
    taskAutoSaveStatus.textContent = "タイトルが必要です";
    taskAutoSaveStatus.dataset.state = "error";
    titleInput.focus();
    return false;
  }

  let taskId = taskIdInput.value;
  let task = tasks.find((item) => item.id === taskId);
  if (!task) {
    const active = getActiveTasks();
    const completed = tasks.filter((item) => item.completed);
    let caseNumber;
    try {
      caseNumber = generateCaseNumber(tasks);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      taskAutoSaveStatus.textContent = "今月の案件番号はすべて使用されています";
      taskAutoSaveStatus.dataset.state = "error";
      return false;
    }
    task = {
      id: crypto.randomUUID(),
      caseNumber,
      title,
      content: "",
      dueDate: "",
      parentCaseId: "",
      tagIds: [],
      links: [],
      completed: false,
      order: active.length,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    active.push(task);
    tasks = [...active, ...completed];
    taskId = task.id;
    taskIdInput.value = taskId;
    dialogTitle.textContent = "タスクを編集";
    dialogCaseNumber.textContent = `案件番号 ${task.caseNumber}`;
  }
  collectTaskFormValues(task);
  if (!task.completed) {
    tasks = moveActiveTaskToPriority(tasks, task.id, prioritySelect.value);
  }
  const snapshot = tasks.map((item) => ({
    ...item,
    tagIds: [...item.tagIds],
    links: [...item.links]
  }));

  taskAutoSaveStatus.textContent = "保存中…";
  taskAutoSaveStatus.dataset.state = "saving";
  taskAutoSavePromise = taskAutoSavePromise
    .catch(() => undefined)
    .then(() => saveTasks(snapshot));

  try {
    tasks = await taskAutoSavePromise;
    taskAutoSaveStatus.textContent = "保存済み";
    taskAutoSaveStatus.dataset.state = "saved";
    render();
    return true;
  } catch (_error) {
    return false;
  }
}

function markTaskEditorDirty() {
  taskAutoSaveStatus.hidden = true;
}

async function handleSubmit(event) {
  event.preventDefault();
  await persistEditedTask();
}

async function addTag(event) {
  event.preventDefault();
  const name = tagNameInput.value.trim();
  tagError.textContent = "";

  if (!name) {
    tagError.textContent = "タグ名を入力してください";
    tagNameInput.focus();
    return;
  }

  if (tags.some((tag) => tag.name.toLocaleLowerCase("ja") === name.toLocaleLowerCase("ja"))) {
    tagError.textContent = "同じ名前のタグがあります";
    tagNameInput.focus();
    return;
  }

  if (tags.length >= 20) {
    tagError.textContent = "タグは20件まで追加できます";
    return;
  }

  tags = await saveTags([...tags, {
    id: crypto.randomUUID(),
    name,
    color: "#2f6fed"
  }]);
  tagForm.reset();
  render();
  showToast("分類タグを追加しました");
}

async function addParentCase(event) {
  event.preventDefault();
  const name = parentCaseNameInput.value.trim();
  const rawUrl = parentCaseUrlInput.value.trim();
  const url = normalizeParentCaseUrl(rawUrl);
  parentCaseError.textContent = "";

  if (!name) {
    parentCaseError.textContent = "親案件名を入力してください";
    parentCaseNameInput.focus();
    return;
  }
  if (rawUrl && !url) {
    parentCaseError.textContent = "URLはhttp://またはhttps://で入力してください";
    parentCaseUrlInput.focus();
    return;
  }
  if (
    parentCases.some((parentCase) =>
      parentCase.name.toLocaleLowerCase("ja") === name.toLocaleLowerCase("ja")
    )
  ) {
    parentCaseError.textContent = "同じ名前の親案件があります";
    parentCaseNameInput.focus();
    return;
  }
  if (parentCases.length >= 1000) {
    parentCaseError.textContent = "親案件は1000件まで登録できます";
    return;
  }

  let caseNumber;
  try {
    caseNumber = generateParentCaseNumber(parentCases);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    parentCaseError.textContent = "今月の親案件番号はすべて使用されています";
    return;
  }

  const parentCase = {
    id: crypto.randomUUID(),
    caseNumber,
    name,
    url,
    ideaMemos: [],
    createdAt: new Date().toISOString()
  };
  parentCases = await saveParentCases([...parentCases, parentCase]);
  parentCaseForm.reset();
  render();
  showToast(`${parentCase.caseNumber}を追加しました`);
}

async function removeTag(tag) {
  const usedCount = tasks.filter((task) => task.tagIds.includes(tag.id)).length;
  const message = usedCount > 0
    ? `「${tag.name}」は${usedCount}件のタスクで使用中です。タグを削除しますか？`
    : `「${tag.name}」タグを削除しますか？`;
  if (!confirm(message)) return;

  tags = tags.filter((item) => item.id !== tag.id);
  tasks = tasks.map((task) => ({
    ...task,
    tagIds: task.tagIds.filter((tagId) => tagId !== tag.id)
  }));
  [tags, tasks] = await Promise.all([saveTags(tags), saveTasks(tasks)]);
  render();
  showToast("分類タグを削除しました");
}

async function clearCompleted() {
  const completed = getDeletableCompletedTasks();
  if (completed.length === 0) return;
  if (!confirm(
    `先月以前に採番された完了タスク${completed.length}件をすべて削除しますか？`
    + "\n今月採番された完了タスクは削除されません。"
  )) return;

  const deletingIds = new Set(completed.map((task) => task.id));
  tasks = await saveTasks(tasks.filter((task) => !deletingIds.has(task.id)));
  render();
  showToast(`先月以前の完了タスク${completed.length}件を削除しました`);
}

document.querySelector("#addTaskButton").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeDetailButton").addEventListener("click", closeTaskDetail);
detailEditButton.addEventListener("click", () => {
  const task = tasks.find((item) => item.id === detailTaskId);
  closeTaskDetail();
  if (task) openTaskDialog(task);
});
taskDetailDialog.addEventListener("click", (event) => {
  if (event.target === taskDetailDialog) closeTaskDetail();
});
document.querySelector("#addFirstTaskButton").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeDialogButton").addEventListener("click", closeTaskDialog);
cancelButton.addEventListener("click", closeTaskDialog);
deleteTaskButton.addEventListener("click", deleteTaskFromEditor);
clearCompletedButton.addEventListener("click", clearCompleted);
taskForm.addEventListener("submit", handleSubmit);
copyActiveTasksButton.addEventListener("click", copyActiveTasks);
toggleActiveListButton.addEventListener("click", () => {
  setActiveListCollapsed(!activeListCollapsed);
});
activeCollapsedNotice.addEventListener("click", () => {
  setActiveListCollapsed(false);
});
tagForm.addEventListener("submit", addTag);
parentCaseForm.addEventListener("submit", addParentCase);
parentCaseManageModeButton.addEventListener("click", () => setParentCaseViewMode("manage"));
parentCaseGroupModeButton.addEventListener("click", showParentCaseGroups);
backupButton.addEventListener("click", downloadBackup);
restoreBackupButton.addEventListener("click", () => restoreFileInput.click());
restoreFileInput.addEventListener("change", handleRestoreFile);
document.querySelector("#closeRestoreDialogButton").addEventListener("click", closeRestoreDialog);
document.querySelector("#cancelRestoreButton").addEventListener("click", closeRestoreDialog);
confirmRestoreButton.addEventListener("click", confirmRestore);
restoreAcknowledge.addEventListener("change", () => {
  confirmRestoreButton.disabled = !restoreAcknowledge.checked;
});
dueDateInput.addEventListener("input", updateDueDateClearButton);
clearDueDateButton.addEventListener("click", () => {
  dueDateInput.value = "";
  updateDueDateClearButton();
  markTaskEditorDirty();
  dueDateInput.focus();
});

titleInput.addEventListener("input", () => {
  if (titleInput.value.trim()) {
    titleError.textContent = "";
    titleInput.classList.remove("is-invalid");
  }
  markTaskEditorDirty();
});

contentInput.addEventListener("input", () => {
  renderContentSelectionHighlights();
  markTaskEditorDirty();
});
contentInput.addEventListener("select", renderContentSelectionHighlights);
contentInput.addEventListener("keyup", renderContentSelectionHighlights);
contentInput.addEventListener("pointerup", renderContentSelectionHighlights);
contentInput.addEventListener("dblclick", () => {
  requestAnimationFrame(() => {
    trimTrailingSpacingFromSelection(contentInput);
    renderContentSelectionHighlights();
  });
});
contentInput.addEventListener("scroll", syncContentHighlightScroll);
dueDateInput.addEventListener("input", markTaskEditorDirty);
taskTagOptions.addEventListener("change", markTaskEditorDirty);
parentCaseSelect.addEventListener("change", markTaskEditorDirty);
prioritySelect.addEventListener("change", markTaskEditorDirty);
parentCaseJumpSelect.addEventListener("change", () => {
  const parentCase = parentCases.find((item) => item.id === parentCaseJumpSelect.value);
  if (!parentCase) return;
  setParentCaseViewMode("group");
  jumpToElement(document.getElementById(getParentCaseAnchorId(parentCase)));
});
taskJumpSelect.addEventListener("change", () => {
  const task = getActiveTasks().find((item) => item.id === taskJumpSelect.value);
  if (!task) return;
  setActiveListCollapsed(false);
  jumpToElement(document.getElementById(getActiveTaskAnchorId(task)));
});
linkInputs.addEventListener("input", (event) => {
  const input = event.target.closest(".link-url-input");
  if (!input) return;
  updateLinkInputIcon(input.closest(".link-input-row"));
  setLinkMessage(
    input.value.trim() && !normalizeTaskLink(input.value)
      ? "http://、https://、mailto:、またはメールアドレスを入力してください。"
      : "URLまたはメールアドレスを登録できます。",
    input.value.trim() && !normalizeTaskLink(input.value) ? "error" : ""
  );
  markTaskEditorDirty();
});
linkInputs.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-link-button");
  if (!button) return;
  const row = button.closest(".link-input-row");
  row.querySelector(".link-url-input").value = "";
  updateLinkInputIcon(row);
  setLinkMessage("リンクを削除しました。", "success");
  markTaskEditorDirty();
});
pasteLinkButton.addEventListener("click", pasteLinksFromClipboard);

parentIdeaDialogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const parentCase = parentCases.find((item) => item.id === ideaMemoParentCaseId);
  const text = parentIdeaDialogInput.value.trim();
  if (!parentCase || !text) return;
  if (parentCase.ideaMemos.length >= TODO_MEMO_MAX_PARENT_IDEA_MEMOS) {
    showToast(`アイデアメモは${TODO_MEMO_MAX_PARENT_IDEA_MEMOS}件まで登録できます`);
    return;
  }
  parentCase.ideaMemos.push({
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString()
  });
  parentCases = await saveParentCases(parentCases);
  parentIdeaDialogInput.value = "";
  render();
  renderParentIdeaDialog();
  parentIdeaDialogInput.focus();
  showToast("アイデアメモを追加しました");
});

function deleteParentIdeaMemoFromEvent(event) {
  const remove = event.target.closest(".parent-idea-dialog-delete");
  if (!remove || remove.dataset.deleting === "true") return;
  remove.dataset.deleting = "true";
  if (event.type === "pointerdown") event.preventDefault();
  applyOpenParentIdeaEdits();
  parentCases = removeParentIdeaMemo(
    parentCases,
    ideaMemoParentCaseId,
    remove.dataset.memoId
  );
  render();
  renderParentIdeaDialog();
  queueParentIdeaSave("アイデアメモを削除しました");
}

parentIdeaDialogList.addEventListener("pointerdown", deleteParentIdeaMemoFromEvent);
parentIdeaDialogList.addEventListener("click", deleteParentIdeaMemoFromEvent);

document.querySelector("#closeParentIdeaDialogButton").addEventListener(
  "click",
  closeParentIdeaDialog
);
parentIdeaDialog.addEventListener("click", (event) => {
  if (event.target === parentIdeaDialog) closeParentIdeaDialog();
});
parentIdeaDialog.addEventListener("close", () => {
  persistOpenParentIdeaEdits();
  ideaMemoParentCaseId = null;
});

taskDialog.addEventListener("click", (event) => {
  if (event.target === taskDialog) closeTaskDialog();
});

taskDialog.addEventListener("cancel", (event) => {
  if (!titleInput.value.trim()) return;
  event.preventDefault();
  closeTaskDialog();
});

window.addEventListener("pagehide", () => {
  if (taskDialog.open && titleInput.value.trim()) persistEditedTask();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && taskDialog.open && titleInput.value.trim()) {
    persistEditedTask();
  }
});

restoreDialog.addEventListener("click", (event) => {
  if (event.target === restoreDialog) closeRestoreDialog();
});

document.addEventListener("click", (event) => {
  if (event.target.closest('a[href^="#active-task-"]')) {
    setActiveListCollapsed(false);
  }
  closeAllMenus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllMenus();
});

tagNameInput.addEventListener("input", () => {
  if (tagNameInput.value.trim()) tagError.textContent = "";
});

manageHolidaysButton.addEventListener("click", () => {
  holidayDateInput.value = formatLocalDateKey(new Date());
  holidayTypeInput.value = "personal";
  renderHolidayList();
  holidayDialog.showModal();
});
document.querySelector("#closeHolidayDialogButton").addEventListener("click", () => holidayDialog.close());
holidayDialog.addEventListener("click", (event) => {
  if (event.target === holidayDialog) holidayDialog.close();
});
holidayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  holidays = await saveHolidays([
    ...holidays.filter((holiday) => holiday.date !== holidayDateInput.value),
    { date: holidayDateInput.value, type: holidayTypeInput.value }
  ]);
  render();
  renderHolidayList();
  showToast("休みを登録しました");
});
holidayList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  holidays = await saveHolidays(holidays.filter((holiday) => holiday.date !== button.dataset.date));
  render();
  renderHolidayList();
  showToast("休みを削除しました");
});

async function refreshFromStorage() {
  const snapshotPromise = loadBackupSnapshot();
  [tasks, tags, parentCases, holidays] = await Promise.all([
    loadTasks(),
    loadTags(),
    loadParentCases(),
    loadHolidays()
  ]);
  updateBackupChangeCount(tasks, tags, parentCases, await snapshotPromise);
  render();
  if (parentIdeaDialog.open) renderParentIdeaDialog();
}

window.addEventListener("storage", refreshFromStorage);
window.addEventListener("todomemo-storage-change", refreshFromStorage);

(async function initialize() {
  if (appVersion) {
    appVersion.textContent = `v${TODO_MEMO_APP_VERSION}`;
  }

  const snapshotPromise = loadBackupSnapshot();
  [tasks, tags, parentCases, holidays] = await Promise.all([
    loadTasks(),
    loadTags(),
    loadParentCases(),
    loadHolidays()
  ]);
  updateBackupChangeCount(tasks, tags, parentCases, await snapshotPromise);
  render();
})();
