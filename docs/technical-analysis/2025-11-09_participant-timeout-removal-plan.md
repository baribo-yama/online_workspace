## 2025-11-09 参加者タイムアウト撤廃と退出処理改善計画

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
   - `handleUnexpectedTermination` に `navigator.sendBeacon` を導入し、ブラウザ／タブ終了でも退出要求をバックエンドに送信。
   - バックエンド（Cloud Functions などのサーバ実装、もしくは既存の Web API）で `transferHostAuthority` 相当の処理を再利用し、対象参加者の Firestore doc 削除とホスト権限移譲／ルーム終了を実行する。
   - 既存フロントエンドだけで処理する場合は `sendBeacon` で直接 Firestore を操作するのが難しいため、バックエンド経由で確実に処理する方針とする。

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


