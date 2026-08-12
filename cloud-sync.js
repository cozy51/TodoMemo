// Supabase is the authoritative copy of the data; localStorage is the offline
// copy of it.  Every upload is guarded by the revision the local copy is based
// on, so a device that has been closed, offline, or restored from an old file
// can never quietly replace newer work made on another PC.  Whenever the two
// sides genuinely disagree the user decides, and the losing side is archived to
// the cloud history first so nothing is lost either way.
(function setupCloudSync() {
  const BUCKET = "todo-backups";
  const LATEST_FILE = "TodoMemo-latest.json";
  const HISTORY_FOLDER = "history";
  const HISTORY_RECENT_KEEP = 30;
  const HISTORY_DAILY_KEEP = 30;
  const HISTORY_LIST_LIMIT = 200;
  const PUSH_DEBOUNCE_MS = 1500;
  const POLL_INTERVAL_MS = 60 * 1000;
  const FOCUS_THROTTLE_MS = 10 * 1000;
  const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

  const config = window.TODO_MEMO_SUPABASE_CONFIG;
  const status = document.querySelector("#cloudSyncStatus");
  const detail = document.querySelector("#cloudSyncDetail");
  const emailInput = document.querySelector("#cloudSyncEmail");
  const passwordInput = document.querySelector("#cloudSyncPassword");
  const signInButton = document.querySelector("#cloudSyncSignIn");
  const signOutButton = document.querySelector("#cloudSyncSignOut");
  const syncNowButton = document.querySelector("#cloudSyncNow");
  const historyButton = document.querySelector("#cloudSyncHistory");
  const resolveButton = document.querySelector("#cloudSyncResolve");

  const conflictDialog = document.querySelector("#cloudConflictDialog");
  const conflictRemoteSummary = document.querySelector("#cloudConflictRemoteSummary");
  const conflictLocalSummary = document.querySelector("#cloudConflictLocalSummary");
  const conflictReason = document.querySelector("#cloudConflictReason");
  const useRemoteButton = document.querySelector("#cloudConflictUseRemote");
  const useLocalButton = document.querySelector("#cloudConflictUseLocal");
  const conflictLaterButton = document.querySelector("#cloudConflictLater");

  const historyDialog = document.querySelector("#cloudHistoryDialog");
  const historyList = document.querySelector("#cloudHistoryList");
  const historyEmpty = document.querySelector("#cloudHistoryEmpty");
  const closeHistoryButton = document.querySelector("#cloudHistoryClose");

  let client = null;
  let user = null;
  let pushTimer = null;
  let pollTimer = null;
  let queue = Promise.resolve();
  let paused = false;
  let pausedMessage = "";
  let pendingConflict = null;
  let lastFocusSyncAt = 0;
  let lastError = "";

  function setStatus(message, state = "idle") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function setDetail(message) {
    if (!detail) return;
    detail.textContent = message || "";
    detail.hidden = !message;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "";
    const sameDay = date.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat("ja-JP", sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    ).format(date);
  }

  function describeDataset(dataset) {
    const tasks = dataset?.tasks?.length || 0;
    const active = (dataset?.tasks || []).filter((task) => !task.completed).length;
    return `タスク${tasks}件（未完了${active}）・親案件${dataset?.parentCases?.length || 0}件`
      + `・タグ${dataset?.tags?.length || 0}件`;
  }

  function updateAuthControls() {
    const signedIn = Boolean(user);
    if (emailInput) emailInput.hidden = signedIn;
    if (passwordInput) passwordInput.hidden = signedIn;
    if (signInButton) signInButton.hidden = signedIn;
    if (signOutButton) signOutButton.hidden = !signedIn;
    if (syncNowButton) syncNowButton.hidden = !signedIn;
    if (historyButton) historyButton.hidden = !signedIn;
    updateResolveControl();
  }

  function updateResolveControl() {
    if (resolveButton) resolveButton.hidden = !pendingConflict;
  }

  function reportIdle(state) {
    if (paused) {
      setStatus(pausedMessage || "同期を保留中", "error");
      return;
    }
    if (lastError) {
      setStatus(lastError, "error");
      setDetail(state.lastSyncedAt ? `最終同期 ${formatTime(state.lastSyncedAt)}` : "ローカルに保存済み");
      return;
    }
    setStatus("クラウドと同期済み", "saved");
    setDetail(state.lastSyncedAt ? `最終同期 ${formatTime(state.lastSyncedAt)}` : "");
  }

  // Every cloud operation runs one at a time: two overlapping syncs could each
  // read the same revision and then both write it.
  function run(task) {
    const next = queue.then(task).catch((error) => {
      console.warn("TodoMemo cloud sync failed:", error);
      lastError = error?.message?.startsWith("同期") || error?.message?.startsWith("クラウド")
        ? error.message
        : "クラウドに接続できません（ローカルに保存済み）";
      reportIdle(loadTodoMemoSyncState(user?.id || ""));
    });
    queue = next;
    return next;
  }

  function objectPath(...parts) {
    return [user.id, ...parts].join("/");
  }

  async function getAccessToken() {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) {
      throw new Error("同期のセッションが切れました。ログインし直してください");
    }
    return data.session.access_token;
  }

  // The storage CDN may serve a cached copy, and a stale read is precisely the
  // failure this feature exists to prevent, so read through a no-store fetch.
  async function downloadObject(path) {
    const token = await getAccessToken();
    const base = String(config.url).replace(/\/+$/, "");
    const url = `${base}/storage/v1/object/authenticated/${BUCKET}/`
      + `${path.split("/").map(encodeURIComponent).join("/")}?ts=${Date.now()}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, apikey: config.anonKey }
    });
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 404 || /not.?found|NoSuchKey/i.test(text)) return null;
      throw new Error(`クラウドの読み取りに失敗しました (${response.status})`);
    }
    if (text.length > MAX_DOCUMENT_BYTES) {
      throw new Error("クラウドのデータが大きすぎます");
    }
    return text;
  }

  async function uploadObject(path, body) {
    const { error } = await client.storage.from(BUCKET).upload(path, body, {
      contentType: "application/json; charset=utf-8",
      // Objects must never be cached: the next device has to see this write.
      cacheControl: "0",
      upsert: true
    });
    if (error) throw new Error(`クラウドへの書き込みに失敗しました：${error.message}`);
  }

  function readDocument(text) {
    const parsed = validateBackup(JSON.parse(text));
    const sync = parsed.sync && typeof parsed.sync === "object" ? parsed.sync : null;
    const revision = Number.isFinite(sync?.revision) && sync.revision > 0
      ? Math.floor(sync.revision)
      : 0;
    const dataset = normalizeDataset(parsed);
    return {
      raw: text,
      dataset,
      revision,
      legacy: !sync || revision === 0,
      updatedAt: String(sync?.updatedAt || parsed.exportedAt || ""),
      deviceName: String(sync?.deviceName || ""),
      fingerprint: createDatasetFingerprint(dataset)
    };
  }

  async function readLatest() {
    const text = await downloadObject(objectPath(LATEST_FILE));
    if (!text) return null;
    try {
      return readDocument(text);
    } catch (error) {
      throw new Error(`クラウドのデータを読み取れませんでした：${error.message}`);
    }
  }

  function createDocument(dataset, revision, previousRevision) {
    const now = new Date();
    return {
      format: "TodoMemo Backup",
      schemaVersion: 3,
      extensionVersion: TODO_MEMO_APP_VERSION,
      exportedAt: now.toISOString(),
      localTimestamp: now.toLocaleString("sv-SE").replace(" ", "_").replaceAll(":", ""),
      sync: {
        revision,
        previousRevision: previousRevision ?? null,
        updatedAt: now.toISOString(),
        deviceId: getTodoMemoDeviceId(),
        deviceName: describeTodoMemoDevice()
      },
      counts: {
        tasks: dataset.tasks.length,
        active: dataset.tasks.filter((task) => !task.completed).length,
        completed: dataset.tasks.filter((task) => task.completed).length,
        tags: dataset.tags.length,
        parentCases: dataset.parentCases.length,
        holidays: dataset.holidays.length
      },
      tasks: dataset.tasks,
      tags: dataset.tags,
      parentCases: dataset.parentCases,
      holidays: dataset.holidays
    };
  }

  // The timestamp leads the name so a plain descending sort is chronological,
  // whatever revision each entry carries.
  function historyName(revision, label) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    return `${stamp}-r${String(revision).padStart(6, "0")}-${label}.json`;
  }

  // Keep the copy that is about to be replaced.  Every overwrite is archived:
  // a restore point is only useful if it sits just before the mistake, and
  // pruneHistory keeps the count bounded.
  async function archiveText(text, revision, label, required = false) {
    try {
      await uploadObject(objectPath(HISTORY_FOLDER, historyName(revision, label)), text);
      await pruneHistory();
    } catch (error) {
      // Losing a routine history copy must not block the sync itself, but an
      // archive taken to protect data that is about to be replaced must.
      console.warn("TodoMemo cloud history write failed:", error);
      if (required) throw error;
    }
  }

  async function listHistory() {
    const { data, error } = await client.storage.from(BUCKET).list(
      objectPath(HISTORY_FOLDER),
      { limit: HISTORY_LIST_LIMIT, sortBy: { column: "name", order: "desc" } }
    );
    if (error) throw new Error("クラウド履歴を読み込めませんでした");
    return (data || [])
      .filter((entry) => entry.name.endsWith(".json"))
      .map((entry) => ({ ...entry, ...parseHistoryName(entry.name) }))
      // Sort here rather than trusting the name order, so entries written under
      // the earlier naming scheme still land in the right place.
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  async function pruneHistory() {
    const entries = await listHistory().catch(() => []);
    const expired = selectExpiredHistory(entries, {
      recentKeep: HISTORY_RECENT_KEEP,
      dailyKeep: HISTORY_DAILY_KEEP
    });
    if (expired.length === 0) return;
    await client.storage.from(BUCKET).remove(
      expired.map((entry) => objectPath(HISTORY_FOLDER, entry.name))
    );
  }

  async function applyRemote(remote) {
    await saveTodoMemoDataset(remote.dataset, { origin: "cloud" });
    // Re-read so the recorded fingerprint describes what is actually stored,
    // including any normalisation the load path applies.
    const stored = await loadTodoMemoDataset();
    const fingerprint = createDatasetFingerprint(stored);
    saveTodoMemoSyncState({
      userId: user.id,
      revision: remote.revision,
      fingerprint,
      remoteUpdatedAt: remote.updatedAt,
      lastSyncedAt: new Date().toISOString()
    });
    return { stored, fingerprint };
  }

  async function pushLocal(local, fingerprint, remote, { force = false, label = "auto" } = {}) {
    const risk = force ? null : assessDatasetShrink(remote?.dataset || null, local);
    if (risk) {
      pendingConflict = { kind: "shrink", risk, remote, local, fingerprint };
      openConflictDialog();
      return;
    }
    const baseRevision = Math.max(remote?.revision || 0, loadTodoMemoSyncState(user.id).revision);
    const payload = createDocument(local, baseRevision + 1, remote?.revision ?? null);
    if (remote) {
      await archiveText(remote.raw, remote.revision, label, force);
    }
    await uploadObject(objectPath(LATEST_FILE), JSON.stringify(payload, null, 2));
    saveTodoMemoSyncState({
      userId: user.id,
      revision: payload.sync.revision,
      fingerprint,
      remoteUpdatedAt: payload.sync.updatedAt,
      lastSyncedAt: payload.sync.updatedAt
    });
  }

  async function synchronize() {
    if (!client || !user || paused || pendingConflict) return;
    setStatus("クラウドと同期中…", "saving");
    const remote = await readLatest();
    const local = await loadTodoMemoDataset();
    const state = loadTodoMemoSyncState(user.id);
    const localFingerprint = createDatasetFingerprint(local);
    const action = decideSyncAction({
      remoteExists: Boolean(remote),
      remoteLegacy: remote?.legacy,
      remoteRevision: remote?.revision,
      remoteFingerprint: remote?.fingerprint,
      baseRevision: state.revision,
      baseFingerprint: state.fingerprint,
      localFingerprint,
      localEmpty: isDatasetEmpty(local)
    });

    lastError = "";
    if (action === "conflict") {
      pendingConflict = { kind: "diverged", remote, local, fingerprint: localFingerprint };
      openConflictDialog();
      return;
    }
    if (action === "pull") {
      const applied = await applyRemote(remote);
      if (applied.fingerprint !== remote.fingerprint) {
        // Storing the cloud copy changed it — an older schema, a reference to a
        // deleted tag.  Publish the cleaned version straight away, otherwise the
        // two sides would disagree forever and every poll would pull again.
        await pushLocal(applied.stored, applied.fingerprint, remote, { label: "normalized" });
      }
    } else if (action === "push") {
      await pushLocal(local, localFingerprint, remote);
    } else if (action === "adopt") {
      saveTodoMemoSyncState({
        userId: user.id,
        revision: remote.revision,
        fingerprint: localFingerprint,
        remoteUpdatedAt: remote.updatedAt,
        lastSyncedAt: new Date().toISOString()
      });
    } else if (action === "idle" && !remote && isDatasetEmpty(local)) {
      setStatus("クラウドにデータがありません", "idle");
      setDetail("このPCで入力すると保存されます");
      return;
    }
    if (pendingConflict) return;
    reportIdle(loadTodoMemoSyncState(user.id));
  }

  function openConflictDialog() {
    const { kind, remote, local, risk } = pendingConflict;
    if (conflictReason) {
      conflictReason.textContent = kind === "shrink"
        ? `このPCの内容はクラウドより${risk.removed}件少なくなっています。`
          + "誤操作やブラウザーデータの削除でないか確認してください。"
        : "他のPCの変更と、このPCの未同期の変更が食い違っています。"
          + "どちらを残すか選んでください。選ばなかった方はクラウド履歴に退避します。";
    }
    if (conflictRemoteSummary) {
      conflictRemoteSummary.textContent = remote
        ? `${describeDataset(remote.dataset)}／更新 ${formatTime(remote.updatedAt) || "不明"}`
          + `${remote.deviceName ? `（${remote.deviceName}）` : ""}`
        : "クラウドにデータがありません";
    }
    if (conflictLocalSummary) {
      conflictLocalSummary.textContent = describeDataset(local);
    }
    if (useLocalButton) {
      useLocalButton.textContent = kind === "shrink"
        ? "確認した：このPCの内容で更新"
        : "このPCの内容を残す";
    }
    paused = true;
    pausedMessage = kind === "shrink"
      ? "同期を保留中（件数が大きく減っています）"
      : "同期を保留中（内容が食い違っています）";
    setStatus(pausedMessage, "error");
    setDetail("「同期の確認」から残す方を選んでください");
    updateResolveControl();
    if (conflictDialog && !conflictDialog.open) conflictDialog.showModal();
  }

  function resumeSync() {
    paused = false;
    pausedMessage = "";
    pendingConflict = null;
    run(synchronize);
  }

  async function resolveWithRemote() {
    const conflict = pendingConflict;
    if (!conflict?.remote) return;
    // Archive this PC's version before dropping it, so an accidental choice here
    // is still recoverable from the cloud history.
    if (!isDatasetEmpty(conflict.local)) {
      const localPayload = createDocument(
        conflict.local,
        loadTodoMemoSyncState(user.id).revision,
        null
      );
      await archiveText(
        JSON.stringify(localPayload, null, 2),
        localPayload.sync.revision,
        "local-conflict",
        true
      );
    }
    await applyRemote(conflict.remote);
    pendingConflict = null;
    paused = false;
    pausedMessage = "";
    updateResolveControl();
    reportIdle(loadTodoMemoSyncState(user.id));
  }

  async function resolveWithLocal() {
    const conflict = pendingConflict;
    if (!conflict) return;
    pendingConflict = null;
    paused = false;
    pausedMessage = "";
    updateResolveControl();
    await pushLocal(conflict.local, conflict.fingerprint, conflict.remote, {
      force: true,
      label: "remote-replaced"
    });
    reportIdle(loadTodoMemoSyncState(user.id));
  }

  function closeConflictDialog() {
    if (conflictDialog?.open) conflictDialog.close();
  }

  function parseHistoryName(name) {
    // Current form is timestamp-first; the leading-revision form was written by
    // the first version of this feature and still has to be readable.
    const match = /^(\d{8})T(\d{6})Z-r(\d+)-(.+)\.json$/.exec(name)
      || /^r(\d+)-(\d{8})T(\d{6})Z-(.+)\.json$/.exec(name);
    if (!match) return { revision: null, date: null, label: name };
    const [day, time, revision] = /^\d{8}T/.test(name)
      ? [match[1], match[2], match[3]]
      : [match[2], match[3], match[1]];
    const iso = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`
      + `T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
    return { revision: Number(revision), date: new Date(iso), label: match[4] };
  }

  const HISTORY_LABELS = {
    auto: "上書き前の内容",
    normalized: "整理前の内容",
    "local-conflict": "このPCの未同期分",
    "remote-replaced": "上書き前のクラウド"
  };

  // Restore points are told apart by their time, so it carries seconds: several
  // can land in the same minute during a burst of edits.
  function formatHistoryTime(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(date);
  }

  async function openHistoryDialog() {
    if (!historyDialog) return;
    historyList.innerHTML = "";
    historyEmpty.textContent = "読み込み中…";
    historyEmpty.hidden = false;
    historyDialog.showModal();

    let entries = [];
    try {
      entries = await listHistory();
    } catch (_error) {
      historyEmpty.textContent = "履歴を読み込めませんでした";
      return;
    }
    if (entries.length === 0) {
      historyEmpty.textContent = "まだ履歴はありません（クラウドが上書きされたときに増えます）";
      return;
    }
    historyEmpty.hidden = true;

    // The current cloud version anchors the list: everything below it is a
    // state the cloud has already moved on from.
    const current = loadTodoMemoSyncState(user.id);
    const currentRow = document.createElement("li");
    currentRow.className = "cloud-history-item cloud-history-current";
    const currentInfo = document.createElement("div");
    const currentHeading = document.createElement("strong");
    currentHeading.textContent = "現在のクラウド";
    const currentNote = document.createElement("span");
    currentNote.textContent = current.remoteUpdatedAt
      ? `更新 ${formatTime(current.remoteUpdatedAt)}`
      : "同期の記録がありません";
    currentInfo.append(currentHeading, currentNote);
    currentRow.append(currentInfo);
    historyList.append(currentRow);

    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "cloud-history-item";
      const info = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = entry.date ? formatHistoryTime(entry.date) : entry.name;
      const note = document.createElement("span");
      note.textContent = HISTORY_LABELS[entry.label] || entry.label;
      info.append(heading, note);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = "この時点に戻す";
      button.addEventListener("click", () => restoreFromHistory(entry.name, button));
      item.append(info, button);
      historyList.append(item);
    });
  }

  async function restoreFromHistory(name, button) {
    const parsed = parseHistoryName(name);
    const when = parsed.date ? formatHistoryTime(parsed.date) : name;
    if (!window.confirm(
      `${when} の内容に戻します。\n`
      + "現在のクラウドの内容は履歴へ退避してから置き換えます。続けますか？"
    )) return;

    button.disabled = true;
    await run(async () => {
      const text = await downloadObject(objectPath(HISTORY_FOLDER, name));
      if (!text) throw new Error("クラウドの履歴を読み取れませんでした");
      const snapshot = readDocument(text);
      const remote = await readLatest();
      if (remote) {
        await archiveText(remote.raw, remote.revision, "remote-replaced", true);
      }
      // Restoring is a deliberate rollback, so it is published as a *new*
      // revision rather than by rewinding the counter — other PCs then pull it
      // forward instead of seeing the cloud jump backwards.
      const revision = Math.max(remote?.revision || 0, loadTodoMemoSyncState(user.id).revision) + 1;
      const payload = createDocument(snapshot.dataset, revision, remote?.revision ?? null);
      await uploadObject(objectPath(LATEST_FILE), JSON.stringify(payload, null, 2));
      await applyRemote({
        ...snapshot,
        revision,
        updatedAt: payload.sync.updatedAt
      });
      reportIdle(loadTodoMemoSyncState(user.id));
    });
    button.disabled = false;
    historyDialog.close();
  }

  function notifyLocalChange() {
    if (!user) return;
    clearTimeout(pushTimer);
    if (paused) {
      setStatus(pausedMessage || "同期を保留中", "error");
      return;
    }
    setStatus("変更を同期待ち…", "saving");
    pushTimer = setTimeout(() => run(synchronize), PUSH_DEBOUNCE_MS);
  }

  function syncNow() {
    clearTimeout(pushTimer);
    lastError = "";
    run(synchronize);
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") run(synchronize);
    }, POLL_INTERVAL_MS);
  }

  async function signIn() {
    if (!client || !emailInput?.value || !passwordInput?.value) {
      setStatus("メールアドレスとパスワードを入力してください", "error");
      return;
    }
    signInButton.disabled = true;
    const { error } = await client.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    signInButton.disabled = false;
    passwordInput.value = "";
    if (error) setStatus("ログインできませんでした", "error");
  }

  if (!config?.url || !config?.anonKey || !window.supabase) {
    setStatus("クラウド同期は未設定（ローカル保存のみ）", "idle");
    setDetail("");
    updateAuthControls();
    return;
  }

  client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  signInButton?.addEventListener("click", signIn);
  signOutButton?.addEventListener("click", () => client.auth.signOut());
  syncNowButton?.addEventListener("click", syncNow);
  historyButton?.addEventListener("click", () => openHistoryDialog());
  closeHistoryButton?.addEventListener("click", () => historyDialog.close());
  useRemoteButton?.addEventListener("click", () => {
    closeConflictDialog();
    run(resolveWithRemote);
  });
  useLocalButton?.addEventListener("click", () => {
    closeConflictDialog();
    run(resolveWithLocal);
  });
  conflictLaterButton?.addEventListener("click", () => {
    closeConflictDialog();
    setStatus(pausedMessage, "error");
    setDetail("「同期の確認」を押すと選び直せます");
  });
  resolveButton?.addEventListener("click", () => {
    if (pendingConflict) openConflictDialog();
  });
  // The dialog must not be dismissable by accident: an unresolved conflict keeps
  // sync paused, which is the safe state.
  conflictDialog?.addEventListener("cancel", (event) => event.preventDefault());

  client.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    updateAuthControls();
    clearTimeout(pushTimer);
    if (!user) {
      clearInterval(pollTimer);
      paused = false;
      pendingConflict = null;
      updateResolveControl();
      setStatus("ログインするとクラウドと同期します", "idle");
      setDetail("ログアウト中の変更はこのPCだけに保存されます");
      return;
    }
    lastError = "";
    setStatus(`${user.email || "ユーザー"} で同期中…`, "saving");
    startPolling();
    run(synchronize);
  });

  // Other tabs write straight to localStorage, so their edits also need pushing.
  window.addEventListener("storage", (event) => {
    if (event.key && !TODO_MEMO_DATASET_STORAGE_KEYS.includes(event.key)) return;
    notifyLocalChange();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
  window.addEventListener("focus", () => {
    if (Date.now() - lastFocusSyncAt < FOCUS_THROTTLE_MS) return;
    lastFocusSyncAt = Date.now();
    if (user) run(synchronize);
  });

  window.todoMemoCloudSync = {
    notifyLocalChange,
    syncNow,
    resumeSync,
    isPaused: () => paused
  };
})();
