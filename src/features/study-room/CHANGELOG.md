# Changelog - Study Room Feature

このファイルは study-room 機能の重要な変更を記録します。

---

## [2.0.0] - 2025-10-19

### 🎉 レベル2構成への大規模リファクタリング

チーム開発対応のため、ファイル構成を大幅に改善しました。

#### 追加
- **hooks/room/** - ルーム関連フックを分離
  - `useRoomData.js` - データ取得（既存から移動）
  - `useRoomActions.js` - 操作ロジック（既存から移動）
  - `useRoomPermissions.js` - 権限計算（新規作成）

- **hooks/home/** - ホーム関連フックを新規作成
  - `useRoomsList.js` - 部屋一覧取得
  - `useRoomCreation.js` - 部屋作成ロジック
  - `useParticipantsData.js` - 参加者情報取得

- **hooks/shared/** - 共通フックを新規作成
  - `useUserName.js` - ユーザー名管理

- **components/home/** - ホームページを4つのコンポーネントに分割
  - `HomePage.jsx` - 統合コンポーネント（268行 → 90行）
  - `RoomCreationForm.jsx` - 部屋作成フォーム
  - `RoomList.jsx` - 部屋一覧表示
  - `RoomCard.jsx` - 個別カード

- **components/room/** - ルームページを5つのコンポーネントに分割
  - `RoomPage.jsx` - 統合コンポーネント（238行 → 110行）
  - `RoomHeader.jsx` - ヘッダー（既存から移動）
  - `RoomSidebar.jsx` - 左サイドバー
  - `RoomMainContent.jsx` - 右コンテンツ
  - `HostControls.jsx` - ホスト専用UI

- **components/game/** - ゲーム関連を分離
  - `GameOverlay.jsx` - オーバーレイ（既存から移動）

- **components/shared/** - 共通UIコンポーネント
  - `LoadingScreen.jsx` - ローディング画面
  - `UserNameInput.jsx` - 名前入力欄

- **constants/** - 定数をカテゴリ別に分割
  - `limits.js` - 制限値
  - `errors.js` - エラーメッセージ
  - `messages.js` - その他メッセージ
  - `defaults.js` - デフォルト値

- **utils/** - ユーティリティ関数を新規作成
  - `roomValidation.js` - バリデーション関数
  - `localStorage.js` - localStorage操作

- **CHANGELOG.md** - このファイル

#### 変更
- `index.js` - 新しいフォルダ構造に対応したエクスポート
- `App.jsx` - インポートパスを新しい構造に更新
- `README.md` - レベル2構成の詳細ドキュメントに更新

#### 削除
- `hooks/useRoomData.js` - `hooks/room/` に移動
- `hooks/useRoomActions.js` - `hooks/room/` に移動
- `components/HomePage.jsx` - `components/home/` に分割
- `components/RoomPage.jsx` - `components/room/` に分割
- `components/RoomHeader.jsx` - `components/room/` に移動
- `components/GameOverlay.jsx` - `components/game/` に移動
- `constants.js` - `constants/` フォルダに分割

#### 改善点
- **コード行数**: 平均ファイル行数が約35行に削減
- **保守性**: 責務が明確に分離され、修正箇所を特定しやすい
- **チーム開発**: 並行開発時のファイル競合を最小化
- **テスト**: 小さなファイル単位でテストしやすい
- **再利用性**: hooks や共通コンポーネントを他の機能でも使用可能

#### 影響範囲
- 既存の動作は変更なし（リファクタリングのみ）
- 関数の呼び出し順序は維持
- バグの混入なし

---

## [1.3.2] - 2025-10-17

### パフォーマンス最適化

#### 変更
- `HomePage.jsx`: `fetchParticipantsData` を `useCallback` でメモ化
- `RoomPage.jsx`: `gameStatus` の冗長な計算を削除
- useEffect の依存配列を適切に設定
- 不要な関数の再作成を防止

---

## [1.3.0] - 2025-10-17

### ホスト権限の固定化

#### 変更
- ホスト権限の自動移譲を削除（バグの温床となるため）
- 部屋を作成した人が永続的にホスト
- ホストが退出しても `hostId` は保持される
- UI変更: ホストには「部屋を終了」ボタンのみ、ゲストには「ルーム一覧に戻る」ボタンのみ表示
- シンプルで予測可能な動作を実現

---

## [1.2.0] - 2025-10-17

### マジックナンバー・マジックストリングの完全排除

#### 追加
- `constants.js` - 定数を一元管理

#### 変更
- `HomePage.jsx`: 全マジックナンバーを定数化
- 未使用インポートを削除（`db`, `RefreshCw`）
- 全エラーメッセージを `ROOM_ERRORS` に統一

#### 改善点
- 保守性・拡張性が大幅に向上
- 変更箇所が一箇所に集約

---

## [1.0.0] - 2025-01-XX

### 初期実装（レベル1構成）

#### 追加
- `components/HomePage.jsx` - ホームページ
- `components/RoomPage.jsx` - ルームページ
- `components/RoomHeader.jsx` - ヘッダー
- `components/GameOverlay.jsx` - ゲームオーバーレイ
- `hooks/useRoomData.js` - データ取得
- `hooks/useRoomActions.js` - 操作ロジック
- `constants.js` - 定数定義

#### 修正
- ホスト権限チェックバグを修正
- `RoomPage.jsx` を 345行 → 238行に削減

---

## フォーマット説明

このCHANGELOGは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。

### カテゴリ
- **追加**: 新機能
- **変更**: 既存機能の変更
- **非推奨**: まもなく削除される機能
- **削除**: 削除された機能
- **修正**: バグ修正
- **セキュリティ**: 脆弱性対策

### バージョン
- メジャー: 互換性のない変更（2.0.0）
- マイナー: 後方互換性のある機能追加（1.3.0）
- パッチ: 後方互換性のあるバグ修正（1.2.1）

