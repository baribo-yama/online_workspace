## 2025-11-14 参加者タイムアウト撤廃と退出処理改善計画

### 背景
- ルーム一覧で参加者名を取得する `useParticipantsData` が 5 分タイムアウト (`isParticipantActive`) を適用していたため、参加者が在室中でも 5 分経過で一覧から名前が消える。
- ホストがブラウザ／タブ終了した際、`leaveRoom()` が呼ばれないケースでは Firestore の参加者ドキュメントが残存し、人数カウントだけが表示される「幽霊参加者」が発生。
- 期待挙動としては「在室中の参加者名を常時表示」「ホストが離脱した場合の自動権限移譲／部屋終了」「強制終了でも参加者ドキュメントを確実に削除」が求められている。

### 段階的な実装ステップ
1. **タイムアウト無効化（止血）**
   - `useParticipantsData` から `isParticipantActive` フィルタを除去し、Firestore に存在する参加者名をそのまま一覧表示する。
   - `ROOM_LIMITS.PARTICIPANT_TIMEOUT_MS` と `isParticipantActive` を非使用化し、後続ステップで削除する。

2. **明示退出フローの再確認**
   - 既存の `handleLeaveRoom`/`handleExplicitExit` による Firestore 参加者ドキュメント削除が確実に動作するかテストで確認。
   - `participantsCount` の更新が `cleanupDuplicateParticipants`/`updateParticipantsCountRef` と整合するか見直す。

3. **予期しない終了時の退出連携**
   - `handleUnexpectedTermination` では Firestore を直接操作せず、`navigator.sendBeacon`（または `fetch` の `keepalive` オプション）で退出 API を呼び出す。
   - バックエンド（Cloud Functions などのサーバ実装、もしくは既存の Web API）がリクエストを受け取り、`transferHostAuthority`・参加者 doc 削除・ルーム削除までを実行する。
   - 現状バックエンドが存在しないため、Firebase Cloud Functions を導入して退出 API を提供する前提とする。
   - バックエンド処理完了後、必要に応じて退出ログを記録する。

4. **ホスト離脱時の自動権限移譲強化**
   - サーバ側で `transferHostAuthority` を再利用し、他参加者がいる場合は新ホストを決定、いない場合はルーム doc を削除。
   - ホスト以外の参加者については doc 削除のみを行う。

5. **フォールバックと定期クリーンアップ**
   - `sendBeacon` が失敗した場合やレスポンス遅延に備え、`cleanupDuplicateParticipants` を拡張して `lastActivity` ベースで幽霊 doc を掃除する処理を設計。
   - Cloud Functions または管理タスクで定期的に監視し、`hostId` と実参加者の整合性をチェック。

### 検証ポイント
- ホストがブラウザ／タブを閉じた直後に、残存参加者が一覧で正しく表示されるか。
- ホスト単独の部屋でブラウザ終了した場合、部屋 doc が即時削除されるか。
- 一般参加者がブラウザ終了した場合、参加者 doc が削除され、人数カウントも一致するか。
- `sendBeacon` 失敗時のフォールバックが正常に動作し、幽霊参加者が長期残存しないか。

### リスクと注意事項
- `beforeunload` イベントはブラウザによって挙動が異なるため、`sendBeacon` 送信に失敗するブラウザの検証が必要。
- サーバサイドでの権限移譲はトランザクションで行い、競合時のリトライ戦略を検討する。
- タイムアウト撤廃後は Firestore に残存する doc が増える可能性があるため、フォールバック処理の導入前に観測期間を設け、実際の残存状況を確認する。

---

### 退出仕様を固めるための検討項目

1. **「退出扱い」の定義と優先処理**  
   - 強制終了時に最低限実行する処理をどうするか（例：Firestore doc 削除と権限移譲を優先し、LiveKit 切断やトースト表示は省略するか）。  
   - `handleExplicitExit` をそのまま呼ぶか、タブ終了専用の軽量処理（B案）を用意するか。  
   - **採用方針**: B案（タブ終了専用の軽量処理）を採用し、強制終了時は Firestore doc 削除と `transferHostAuthority` など最小限の処理だけを確実に実行する。

2. **処理完了の保証策**  
   - `beforeunload` 中に Firestore 操作が完了しなかった場合のフォールバックをどうするか（例：`lastActivity` を更新し、後でクリーンアップする）。  
   - `navigator.sendBeacon` を採用するか、既存の同期処理だけで押し切るか。  
   - **採用方針**: `beforeunload` では従来の同期的な Firestore 呼び出しで軽量処理を実行し、完了しなかった場合に備えて `lastActivity` 等の情報を残し、後続のクリーンアップ処理で整合を取る。

3. **権限移譲時の一貫性**  
   - 強制退出でも既存の `transferHostAuthority` を必ず使うのか、一部ロジックを切り出すのか。  
   - 自動権限移譲後のトースト表示やログ通知など、UI／UX の扱いをどうするか。  
   - **採用方針**: 強制退出でも既存の `transferHostAuthority` をそのまま利用し、ホスト移譲／ルーム削除まで一貫して実行する。UI のトースト表示は行わず、必要ならログ記録のみとする。

4. **`localStorage` と再入室の扱い**  
   - タブ終了時に `localStorage.participantId` が残った場合、再入室フローをどう扱うか。  
   - `handleReloadEntry` による doc 再利用／新規作成ロジックを前提として維持するか。  
   - **採用方針**: タブ終了時は `beforeunload` の軽量処理で `localStorage.removeItem` を試みつつ、失敗して残るケースに備える。再入室時は現行の `handleReloadEntry` の挙動（doc が残っていれば再利用／無ければ新規作成）を維持する。`active` フィールドによるフィルタリングは廃止し、Firestore の参加者 doc をそのまま扱う。

5. **ログと監視**  
   - 強制退出が発生したことをどこに記録するか（クライアント／サーバ）。  
   - 権限移譲失敗やルーム削除失敗が起きた際の通知・アラート方針。

6. **テスト・検証範囲**  
   - どのブラウザ／環境で強制退出を検証するか。  
   - QA 手順（ホスト単独／複数参加者／ネットワーク切断など）の洗い出し。


