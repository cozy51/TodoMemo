# TodoMemo

「今すること」を一番上に置き、案件をまとめて管理できるシンプルなWebアプリです。

## 主な機能

- タスクの追加・編集・削除・完了、ドラッグやボタンによる優先順位変更
- 案件番号の自動採番、親案件、分類タグ、関連リンク、期限の管理
- 今月から3か月分の期限カレンダーと休日設定
- Markdown対応の内容欄と、案件情報のクリップボードコピー
- すべてのデータのJSONバックアップ／復元
- データはブラウザーの `localStorage` に保存し、ログイン時はSupabase Storageへ自動バックアップ

## ローカルで開く

このアプリはビルドを必要としない静的Webアプリです。リポジトリのルートで任意のHTTPサーバーを起動し、表示されたURLへアクセスしてください。

```sh
python3 -m http.server 8000
```

その後、`http://localhost:8000/` を開きます。`file://` で直接開くのではなくHTTPサーバーを利用してください。

## Vercelへ公開する

1. このリポジトリをVercelへインポートします。
2. Framework Presetは **Other** のままにします。
3. Build CommandとOutput Directoryは未指定のままデプロイします。
4. Project Settings → Environment Variablesに `SUPABASE_URL` と `SUPABASE_ANON_KEY` を登録し、再デプロイします。値はリポジトリへコミットしないでください。`SUPABASE_SERVICE_ROLE_KEY` は不要で、ブラウザーへ公開してはいけません。

`index.html` が通常のURL（`/`）のエントリーポイントです。Vercel用設定は `vercel.json` に含まれています。

## データ保存について

データはアクセス元（プロトコル・ホスト・ポート）ごとの `localStorage` に保存されます。別のブラウザー、端末、ドメインには自動同期されません。ドメイン変更やブラウザーデータ削除の前には、画面上部の「全データをバックアップ」からJSONファイルを保存してください。

## Supabase自動バックアップの設定

データを変更すると、ローカル保存の完了後に約1.2秒まとめて、非公開バケット `todo-backups` の `<ユーザーID>/TodoMemo-latest.json` へ上書きします。通信に失敗してもローカルデータとアプリ操作には影響しません。従来のJSONダウンロードとファイルからの復元も引き続き利用できます。

1. Supabase Authenticationで **Email** プロバイダーを有効にし、利用者を作成します。
2. 作成済みの `todo-backups` バケットが **Publicではない**ことを確認します。
3. StorageのSQL Editorで次のRLSポリシーを作成します。ユーザーIDを先頭フォルダーにすることで、本人のファイルだけを読み書きできます。

```sql
create policy "TodoMemo users can read own backup"
on storage.objects for select to authenticated
using (bucket_id = 'todo-backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "TodoMemo users can create own backup"
on storage.objects for insert to authenticated
with check (bucket_id = 'todo-backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "TodoMemo users can update own backup"
on storage.objects for update to authenticated
using (bucket_id = 'todo-backups' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'todo-backups' and (storage.foldername(name))[1] = (select auth.uid()::text));
```

4. Supabase Project Settings → APIでProject URLとanon/publishable keyを確認し、Vercelの `SUPABASE_URL`、`SUPABASE_ANON_KEY` に設定します。anon keyはRLS適用下で使う公開用キーですが、環境ごとの設定として管理します。
5. デプロイ後、画面上部からメールアドレスとパスワードでログインします。Supabaseクライアントがセッションをブラウザーに永続化するため、同じPC・同じブラウザーではログイン状態が保持されます。

ローカル開発で自動バックアップも確認する場合は `vercel dev` を使い、Vercel CLIの環境変数（例: `.env.local`。Git管理対象外）に同じ2変数を設定してください。単純なHTTPサーバーでは `/api/supabase-config.js` が動作しないため、自動バックアップは「未設定」と表示され、ローカル保存だけで動作します。
