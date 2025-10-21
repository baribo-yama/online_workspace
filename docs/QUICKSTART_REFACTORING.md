# クイックスタート: AI駆動リファクタリング — MOKU

**今すぐコピペして使える！効率的なリファクタリング指示集**

このドキュメントは、AIにそのままコピペして指示できるテンプレート集です。

---

## 🚀 今すぐ始める3ステップ

### **ステップ1: Lintエラーを全修正（所要時間: 3-4時間）**

```
【AIへの指示（そのままコピペ）】

@docs/CODING_RULES.md @docs/ARCHITECTURE.md @docs/AI_REFACTORING_WORKFLOW.md を参照して、
Lint駆動リファクタリングを実行してください。

## Phase 1: 環境設定（5分）
@eslint.config.js の globalIgnores に 'server' と 'test-websocket-server.js' を追加

検証: npm run lint
期待結果: エラー数が27個から16個に減少

## Phase 2: セキュリティ問題修正（15分）
@src/shared/services/firestore.js:118
- エラー: Do not access Object.prototype method 'hasOwnProperty'
- 修正: Object.hasOwn() を使用

検証: npm run lint
期待結果: エラーが1個減少

## Phase 3: React Hooks警告修正（1時間）
以下の4つの警告を修正:
1. src/features/entertainment/hooks/useFaceObstacleGame.js:85
2. src/features/entertainment/hooks/useFaceObstacleGame.js:99
3. src/features/timer/hooks/useSharedTimer.js:134
4. src/features/timer/hooks/useSharedTimer.js:153

修正方法: 依存配列に不足している変数を追加
注意: useCallback でメモ化が必要な場合は実施

検証: npm run lint + タイマーとゲーム機能の動作確認

## Phase 4: 未使用変数削除（1時間）
以下の7つの未使用変数を削除:
1. src/features/collaboration/hooks/useParticipants.js:46 (db)
2. src/features/entertainment/components/FaceObstacleGame.jsx:22 (faceImage, setFaceImage)
3. src/features/entertainment/hooks/useFaceObstacleGame.js:5 (validateWebSocketUrl)
4. src/features/timer/components/PersonalTimer.jsx:4 (motion)
5. src/features/timer/hooks/useSharedTimer.js:4 (db)
6. src/features/timer/hooks/useSharedTimer.js:6 (calculateTimerState)

修正方法: 本当に不要ならインポートから削除、将来使う予定があれば大文字変数名に変更

検証: npm run lint
期待結果: エラー 0個 ✅

## Phase 5: 最終検証（30分）
1. npm run build:dev でビルド成功を確認
2. npm run dev で開発サーバー起動
3. 以下の機能を手動テスト:
   - ルーム作成・入室
   - ビデオ通話
   - タイマー機能
   - ゲーム機能

## Phase 6: レポート作成（30分）
@docs/templates/REFACTORING_REPORT.md を使用して、
@docs/refactoring-reports/2025-10-21_lint-error-fixes.md を更新。

含める内容:
- 各Phaseの修正詳細
- ビフォー・アフター比較（27個 → 0個）
- 動作確認結果
- 学びと次のステップ

---

条件:
- 既存の動作を絶対に変えない
- 各Phase完了後に必ず検証
- エラーが出たら次のPhaseに進まない
- 全ての変更をGitコミット
```

---

### **ステップ2: participantsCount不整合を修正（所要時間: 3-4時間）**

```
【AIへの指示（そのままコピペ）】

@docs/01_current-spec.md @docs/ARCHITECTURE.md を参照して、
participantsCount の不整合問題を修正してください。

## Phase 1: 現状分析（30分）
@src/features/collaboration/hooks/useParticipants.js を分析して、
以下を特定:
1. participantsCount が更新されるタイミング
2. 不整合が発生するシナリオ
3. 根本原因

分析結果をドキュメント化:
docs/technical-analysis/2025-10-21_participantscount-analysis.md

## Phase 2: 解決策の検討（30分）
3つの解決策を提案:
1. Firebase Functions での自動管理
2. クライアント側での動的カウント
3. 退出前の明示的更新

各案のメリット・デメリット、工数見積もりを含める

## Phase 3: 実装（2時間）
推奨案（方法2: クライアント側での動的カウント）を実装:

実装内容:
- src/features/study-room/hooks/home/useRoomsList.js を更新
- participants サブコレクションから動的にカウント
- パフォーマンスへの影響を最小化（リスナーの最適化）

条件:
- ホーム画面の表示速度を維持
- リアルタイム更新を保持
- participantsCount フィールドは段階的に廃止

## Phase 4: テスト（1時間）
以下のシナリオをテスト:
1. 複数人が同時に入室
2. 複数人が同時に退室
3. 全員退室後のカウント表示
4. ホーム画面でのリアルタイム更新

期待結果:
- 常に正確な参加者数が表示される
- ゴーストルーム（誰もいないのにカウントが残る）がない

## Phase 5: ドキュメント更新（30分）
1. @docs/01_current-spec.md を更新
   - participantsCount の挙動を正確に記載
2. 技術分析レポートを完成
3. リファクタリングレポート作成

---

条件:
- @docs/ARCHITECTURE.md の設計原則に従う
- 既存の動作を壊さない
- npm run lint でエラーなし
```

---

### **ステップ3: 新機能追加（所要時間: 1日）**

```
【AIへの指示（そのままコピペ）】

@docs/02_expected-spec.md の #5「入室前のカメラ／マイク初期設定」を実装してください。

## Phase 1: 設計（1時間）
@docs/ARCHITECTURE.md を参照して、以下を設計:

1. フォルダ構成:
   - src/features/study-room/components/home/MediaSettings.jsx
   - src/features/study-room/hooks/home/useMediaSettings.js
   - src/features/study-room/constants/media.js

2. データフロー:
   - MediaDevices API → useMediaSettings → localStorage → VideoCallRoom

3. UI設計:
   - ホーム画面の名前入力フィールドの下に配置
   - カメラON/OFFトグル + マイクON/OFFトグル
   - ブラウザ権限未許可時のメッセージ

設計ドキュメントを作成:
docs/technical-analysis/2025-10-21_media-settings-design.md

## Phase 2: 実装（3時間）
設計に従って実装:

ファイル1: src/features/study-room/hooks/home/useMediaSettings.js
- MediaDevices API でデバイス一覧取得
- ON/OFF状態の管理（useState）
- localStorage への保存・読み込み
- ブラウザ権限のチェック

ファイル2: src/features/study-room/components/home/MediaSettings.jsx
- カメラON/OFFトグルUI
- マイクON/OFFトグルUI
- 権限エラー時のメッセージ
- アクセシビリティ対応（aria-label等）

ファイル3: src/features/study-room/constants/media.js
- デフォルト設定
- localStorage のキー名
- エラーメッセージ

ファイル4: VideoCallRoom.jsx の更新
- localStorage から設定を読み込み
- 初期状態として適用

条件:
- @docs/CODING_RULES.md に準拠
- 1ファイル200行以下
- UIとロジックを分離
- 既存のビデオ通話機能を壊さない

## Phase 3: テスト（1時間）
テストシナリオ:
1. カメラOFF設定で入室 → カメラがOFFで入室
2. マイクOFF設定で入室 → マイクがOFFで入室
3. 両方ON設定で入室 → 両方ONで入室
4. ブラウザ権限拒否時 → 適切なメッセージ表示
5. 設定がlocalStorageに保存される
6. 入室後も手動で切り替え可能

## Phase 4: ドキュメント更新（1時間）
1. @docs/01_current-spec.md を更新
   - 2.1 に「入室前設定機能」を追加
2. @docs/03_gap-list.md を更新
   - 「入室前カメラ/マイク設定: 完了」にマーク
3. リファクタリングレポート作成
   - docs/refactoring-reports/2025-10-21_media-settings-implementation.md
4. README.md の機能一覧を更新

---

条件:
- @docs/02_expected-spec.md の仕様に完全に準拠
- @docs/ARCHITECTURE.md の Feature-based architecture に従う
- npm run lint でエラーなし
- 全機能の動作確認完了
```

---

## 📚 **ドキュメント構成の全体像**

### **作成されたドキュメント体系**

```
docs/
├── 【プロジェクト概要】
│   └── PROJECT_OVERVIEW.md           ← プロジェクト全体像（スコープ・ロードマップ含む）
│
├── 【要件定義】
│   ├── 01_current-spec.md            ← 現状仕様
│   ├── 02_expected-spec.md           ← 期待仕様
│   └── 03_gap-list.md                ← ギャップリスト
│
├── 【設計・ガイドライン】
│   ├── ARCHITECTURE.md               ← アーキテクチャ設計
│   ├── CODING_RULES.md               ← コーディング規約
│   ├── tech-stack.md                 ← 技術スタック
│   ├── AI_GUIDELINES.md              ← AI支援開発ガイドライン
│   ├── AI_REFACTORING_WORKFLOW.md    ← AI駆動リファクタリング実践 🆕
│   └── TEAM_DEVELOPMENT.md           ← チーム開発ガイド
│
├── 【トラブルシューティング】
│   ├── FAQ.md                        ← よくある質問
│   ├── bugs.md                       ← バグ管理
│   └── technical-analysis/           ← 技術分析レポート
│       ├── README.md
│       └── 2025-10-21_livekit-reload-issue-analysis.md
│
├── 【変更履歴】
│   └── refactoring-reports/          ← リファクタリングレポート
│       ├── 2025-10-19_study-room_level2-refactoring.md
│       ├── 2025-10-19_video-call_bug-fixes.md
│       └── 2025-10-21_lint-error-fixes.md
│
└── 【テンプレート】
    └── templates/
        └── REFACTORING_REPORT.md
```

---

# 🎉 完成！AI駆動リファクタリングワークフロー

## ✅ **作成されたドキュメント**

### **1. メインガイド**
**ファイル**: `docs/AI_REFACTORING_WORKFLOW.md`

**内容:**
- 3つの基本方針（ドキュメントファースト、自動検出ツール活用、段階的改善）
- 4つの効率的リファクタリング手法
  1. Lint駆動リファクタリング（最速・最効率）
  2. 仕様駆動リファクタリング（仕様のずれを修正）
  3. バグ駆動リファクタリング（品質向上）
  4. パフォーマンス駆動リファクタリング（最適化）
- ドキュメント活用戦略
- AIへの効果的な指示テンプレート
- 成功のための5つの原則

### **2. クイックスタートガイド**
**ファイル**: `docs/QUICKSTART_REFACTORING.md`

**内容:**
- 今すぐコピペして使える指示テンプレート3つ
  1. Lintエラー全修正（3-4時間）
  2. participantsCount不整合修正（3-4時間）
  3. 新機能追加（1日）
- 各Phase詳細な手順と検証方法

---

## 🎯 **この手法の強み**

### **1. 効率性**
- ⏱️ **従来**: 手動で問題を探して修正（2-3日）
- ⚡ **新手法**: 自動検出→AIに指示（4-6時間）
- 📈 **効率化**: **4-6倍の速度向上**

### **2. 品質保証**
- ✅ ドキュメントファーストで仕様のずれを防止
- ✅ Lintエラー0で潜在的バグを排除
- ✅ 段階的検証で問題の早期発見

### **3. 知識の蓄積**
- 📚 全ての修正がレポート化される
- 🧠 AIが過去の修正から学習
- 👥 チームメンバーが知見を共有

### **4. 再現性**
- 📋 テンプレートをコピペするだけ
- 🔄 同じ手法で繰り返し改善
- 📊 結果が予測可能

---

## 💡 **使い方**

### **シナリオ1: Lintエラーを今すぐ全部直したい**

```bash
# 1. QUICKSTART_REFACTORING.md を開く
# 2. 「ステップ1」の指示をコピー
# 3. AIにペースト
# 4. 3-4時間後にエラー0を達成 ✅
```

### **シナリオ2: 新機能を追加したい**

```bash
# 1. docs/02_expected-spec.md で実装したい機能を選ぶ
# 2. QUICKSTART_REFACTORING.md の「ステップ3」をコピー
# 3. 機能番号を変更してAIにペースト
# 4. 1日後に機能が完成 ✅
```

### **シナリオ3: バグを修正したい**

```bash
# 1. docs/technical-analysis/ で関連レポートを探す
# 2. レポートの「追加の修正提案」を確認
# 3. AI_REFACTORING_WORKFLOW.md の「バグ駆動リファクタリング」を参照
# 4. AIに指示して修正 ✅
```

---

## 🚀 **今日から始める最短ルート**

### **最優先タスク（今日）**

```
1. eslint.config.js を更新（5分）
   → globalIgnores に 'server' を追加
   → npm run lint で確認（27個 → 16個）

2. AIに Lint修正を依頼（3時間）
   → QUICKSTART_REFACTORING.md の指示をコピペ
   → 16個 → 0個を達成

3. 動作確認（30分）
   → 全機能をブラウザでテスト
   → 問題なければGitコミット
```

### **今週中のタスク（1週間）**

```
1. participantsCount 修正（1日）
2. 入室前カメラ/マイク設定追加（1日）
3. ホスト退出・権限移譲実装（2日）
4. ドキュメント同期（1日）
```

---

## 📋 **関連ドキュメント**

- [AI_REFACTORING_WORKFLOW.md](./AI_REFACTORING_WORKFLOW.md) - 詳細なワークフロー
- [AI_GUIDELINES.md](./AI_GUIDELINES.md) - AI支援開発の基本
- [CODING_RULES.md](./CODING_RULES.md) - コーディング規約
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ設計

---

**作成日:** 2025-10-21  
**更新者:** AI (Cursor Agent)

