(function setupCloudBackup() {
  const status = document.querySelector("#cloudBackupStatus");
  const emailInput = document.querySelector("#cloudBackupEmail");
  const passwordInput = document.querySelector("#cloudBackupPassword");
  const signInButton = document.querySelector("#cloudBackupSignIn");
  const signOutButton = document.querySelector("#cloudBackupSignOut");
  const config = window.TODO_MEMO_SUPABASE_CONFIG;
  let client = null;
  let user = null;
  let timer = null;

  function setStatus(message, state = "idle") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function updateAuthControls() {
    const signedIn = Boolean(user);
    if (emailInput) emailInput.hidden = signedIn;
    if (passwordInput) passwordInput.hidden = signedIn;
    if (signInButton) signInButton.hidden = signedIn;
    if (signOutButton) signOutButton.hidden = !signedIn;
  }

  function readCollection(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (_error) {
      return [];
    }
  }

  function createBackup() {
    const tasks = readCollection(TODO_MEMO_STORAGE_KEY);
    const tags = readCollection(TODO_MEMO_TAGS_STORAGE_KEY);
    const parentCases = readCollection(TODO_MEMO_PARENT_CASES_STORAGE_KEY);
    const holidays = readCollection(TODO_MEMO_HOLIDAYS_STORAGE_KEY);
    const now = new Date();
    return {
      format: "TodoMemo Backup",
      schemaVersion: 3,
      extensionVersion: typeof TODO_MEMO_APP_VERSION === "string" ? TODO_MEMO_APP_VERSION : "web",
      exportedAt: now.toISOString(),
      localTimestamp: now.toLocaleString("sv-SE").replace(" ", "_").replaceAll(":", ""),
      counts: {
        tasks: tasks.length,
        active: tasks.filter((task) => !task.completed).length,
        completed: tasks.filter((task) => task.completed).length,
        tags: tags.length,
        parentCases: parentCases.length,
        holidays: holidays.length
      },
      tasks, tags, parentCases, holidays
    };
  }

  async function upload() {
    if (!client || !user) return;
    setStatus("自動バックアップ中…", "saving");
    try {
      const body = JSON.stringify(createBackup(), null, 2);
      const { error } = await client.storage
        .from("todo-backups")
        .upload(`${user.id}/TodoMemo-latest.json`, body, {
          contentType: "application/json; charset=utf-8",
          upsert: true
        });
      if (error) throw error;
      setStatus(`自動バックアップ済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`, "saved");
    } catch (error) {
      console.warn("TodoMemo automatic backup failed:", error);
      setStatus("自動バックアップ失敗（ローカル保存済み）", "error");
    }
  }

  function schedule() {
    if (!user) return;
    clearTimeout(timer);
    setStatus("変更を待機中…", "saving");
    timer = setTimeout(upload, 1200);
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
    setStatus("自動バックアップ未設定", "idle");
    updateAuthControls();
    return;
  }

  client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  signInButton?.addEventListener("click", signIn);
  signOutButton?.addEventListener("click", () => client.auth.signOut());
  client.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    updateAuthControls();
    if (user) {
      setStatus(`ログイン中: ${user.email || "ユーザー"}`, "saved");
      schedule();
    } else {
      setStatus("ログインすると自動バックアップします", "idle");
    }
  });

  window.todoMemoCloudBackup = { schedule };
})();
