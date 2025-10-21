# CODING_RULES — MOKU

## 目的
このドキュメントは、MOKU プロジェクトにおける命名規則・フォーマット・開発運用ルールを統一し、  
AI支援開発とチーム開発を両立させることを目的とする。

---

## 🚫 禁止事項

### **UI・機能追加時の必須確認**
新しいUIや機能を追加する場合は、**必ず事前に確認を取ること**。

#### **確認が必要な項目**
- [ ] ユーザーからの明示的な要求があるか
- [ ] 既存機能との重複がないか
- [ ] アーキテクチャに適合するか
- [ ] パフォーマンスに影響しないか
- [ ] 保守性を損なわないか

#### **確認プロセス**
1. **ユーザーへの確認**: 新しいUIや機能の追加前に必ず確認
2. **設計レビュー**: アーキテクチャに適合するかチェック
3. **実装**: 承認後に実装開始
4. **テスト**: 動作確認とドキュメント更新

---

## 📋 開発ルール

### **1. ファイルサイズ制限**
- **1ファイル200行以下**: 超過時は責務単位で分割
- **コンポーネント**: 単一責務の原則
- **カスタムフック**: 特定の機能に特化

### **2. コード品質**
- **linterエラー**: ゼロエラー必須
- **未使用コード**: 即座に削除
- **命名規則**: このドキュメントに準拠

### **3. アーキテクチャ準拠**
- **Feature-Based Architecture**: 機能単位での整理
- **UI/ロジック分離**: コンポーネントは表示専用
- **カスタムフック**: ロジック層の分離

---

## ファイル命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| コンポーネント | PascalCase | VideoRoom.jsx, ChatPanel.jsx |
| hooks | camelCase（use プレフィックス必須） | useTimer.js, useVideoCall.js |
| 定数ファイル | camelCase | constants.js |
| コンフィグ | camelCase | livekitConfig.js |
| ユーティリティ | camelCase | helpers.js, validation.js |
| ディレクトリ名 | kebab-case | video-call, pomodoro-timer |
| ドキュメント | スネークケース | PROJECT_OVERVIEW.md |

---

## 定数の命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| グローバル定数オブジェクト | UPPER_SNAKE_CASE | `ROOM_LIMITS`, `TIMER_STATE` |
| 定数オブジェクトのプロパティ | UPPER_SNAKE_CASE | `ROOM_LIMITS.MAX_PARTICIPANTS` |
| ローカル定数 | camelCase も許容 | `const maxRetries = 3;` |

### 定数オブジェクトの使用例
```javascript
// constants.js
export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 5,
  MAX_ACTIVE_ROOMS: 3,
  PARTICIPANT_TIMEOUT_MS: 3600000
};

export const ROOM_ERRORS = {
  NOT_HOST: "部屋を終了できるのはホストのみです。",
  NAME_REQUIRED: "名前を入力してください。"
};

// 使用例
if (count > ROOM_LIMITS.MAX_PARTICIPANTS) {
  alert(ROOM_ERRORS.LIMIT_EXCEEDED);
}
```

---

## コーディングスタイル

- インデント: スペース2  
- 文字コード: UTF-8  
- 改行コード: LF  
- 末尾セミコロン: 必須  
- クォート: ダブルクォート " "  
- 関数:
  - コンポーネント: アロー関数を推奨（例: `export const HomePage = () => {}`）
  - 関数宣言も許容（例: `function Home() {}`）※既存コードとの互換性
  - イベントハンドラ: アロー関数必須（例: `const handleClick = () => {}`）
  - hooks: アロー関数必須（例: `export const useTimer = () => {}`）
- import順:
  1. React本体（react, react-dom）  
  2. 外部ライブラリ（Firebase, React Router, LiveKit など）  
  3. アイコンライブラリ（lucide-react など）  
  4. 内部共有モジュール（`@/shared/`）  
  5. 他 feature からの import  
  6. 同一 feature 内 import  
  7. CSS / アセット  
  8. 空行で各グループを区切ることを推奨  
- 型定義: TypeScript 導入後は明示型を推奨（将来対応）

---

## Reactコンポーネント指針

### コンポーネントの責務
- UI専用コンポーネント（表示・イベント受け取りのみ）と  
  ロジック層（hooks）を明確に分離する。  
- props は必要最小限のデータとコールバック関数のみ。

### 状態管理
- 状態を複数コンポーネントで共有する場合は useContext または上位 hooks で集約。  
- Firestore や LiveKit などの副作用は hooks 側に集約。

### メモ化
- 再レンダリング頻発が疑われる箇所では React.memo / useCallback / useMemo を使用。

---

## コメントとドキュメント

### コメントの書き方
- コメントは「なぜそうしたか」を中心に書く。  
  - ❌ // set state  
  - ✅ // Avoid double rendering when reconnecting LiveKit session
- ファイル先頭に概要コメントを1行入れる。
- 機能全体の説明は各 feature の README.md に記載。

### 言語方針
- **コメント**: 日本語 OK（チームメンバーが日本人中心のため）
- **変数名・関数名**: 英語必須
- **commit message**: 英語推奨（ただし日本語も許容）
- **ドキュメント**: 日本語メイン

---

## コミットルール

### 命名規則（英語推奨）
```
feat: add chat feature to room view
fix: prevent participantList from missing entries
refactor: split videoCall logic from component
docs: update PROJECT_OVERVIEW
chore: update dependencies
```

### コミット粒度
- 1コミット＝1つの責務（1修正 or 1機能単位）  
- バグ修正とリファクタを同時に行わない  
- ドキュメント修正は docs: prefix を使用

---

## ブランチ運用ルール

| ブランチ | 用途 |
|-----------|------|
| main | 公開用・本番リリース |
| develop | 安定動作確認済み（MVP / テスト導入前段階） |
| feature/* | 機能開発（例: feature/chat, feature/background-blur） |
| fix/* | バグ修正（例: fix/participant-list, fix/room-limit） |
| docs/* | ドキュメント更新 |

### 命名規則例
- feature/chat-ui  
- feature/mic-toggle-setting  
- fix/max-participant-limit

### マージフロー
- `feature/*` → `develop` → `main`
- `fix/*` → `develop` → `main`（緊急の場合も同様）
- `docs/*` → `develop` → `main`
- **develop での動作確認後にのみ main へマージ**

---

## Pull Request（PR）ルール

- PRタイトルは簡潔に（例: Add camera/mic toggle setting before joining room）  
- PRには 目的・変更内容・確認方法 を3行程度で記述。  
- レビュー前に `npm run lint` と `npm run build` を実行。  
- PR単位は最大500行程度を目安（AIレビュー支援の上限を考慮）。
  - ただし、リファクタリングでファイル分割する場合は、ロジック変更がなければ行数制限を緩和可能
  - 1PRでの変更ファイル数は10ファイル以下を推奨

---

## Lint / Format

- **ESLint** を導入済み（ルール変更は全員合意後）  
- **Prettier** は未導入（将来的に導入を検討）  
- 保存時自動整形を推奨（VS Code設定）  
- ESLintルール変更時は `docs/CODING_RULES.md` に追記する。

---

## 🔧 技術的制約

### **LiveKit設定**
- **サーバーURL**: HTTPSプロトコルを使用
- **WebSocket**: 適切なプロトコル設定
- **トークン生成**: セキュアな実装

### **エラーハンドリング**
- **ユーザーフレンドリー**: 技術的詳細を隠す
- **適切なフォールバック**: エラー時の代替手段
- **ログ出力**: デバッグ情報の適切な管理

### **よくある技術的問題**

#### **問題1: WSS URLエラー**
```
Fetch API cannot load wss://... URL scheme "wss" is not supported.
```

**原因**: WebSocket URLをHTTPのFetch APIで使用  
**対処法**: HTTPSプロトコルに変更

```javascript
// ❌ 間違い
serverUrl: 'wss://example.livekit.cloud'

// ✅ 正しい
serverUrl: 'https://example.livekit.cloud'
```

#### **問題2: 不要なUI追加**
**症状**: ユーザーが要求していないUIが追加される  
**対処法**: 事前確認プロセスの徹底

#### **問題3: 未使用コードの蓄積**
**症状**: linterエラー、コードの肥大化  
**対処法**: 定期的なクリーンアップ

---

## TypeScript 対応

### 現状
- 型定義ファイル（`@types/*`）は導入済み
- 実装ファイルは `.jsx` / `.js` を使用中

### 将来的な方針
- 段階的に `.tsx` / `.ts` への移行を検討
- 新規機能は TypeScript での実装を推奨（任意）
- 既存コードの TypeScript 化は優先度低
- 移行時は feature 単位で行う（混在を避ける）

### TypeScript 導入時のルール（予定）
```typescript
// 明示的な型定義を推奨
interface RoomData {
  id: string;
  title: string;
  participantsCount: number;
}

// Props の型定義
interface RoomCardProps {
  room: RoomData;
  onJoin: (roomId: string) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin }) => {
  // ...
};
```

---

## AI利用時の注意

### **基本方針**
- AIに修正を依頼する際は「feature単位」で範囲を指定する。  
  ```
  features/room/hooks/useRoom.js を修正。
  ARCHITECTURE.md の方針を守り、UIとロジックを分離した構成で。
  ```
- ドキュメント修正時は対象ファイル名を必ず含める。  
- バグ対応時は docs/BUGS.md の該当IDを明示する。

### **📝 リファクタリング時の必須タスク（重要）**

**AIによるリファクタリング作業を完了した際は、必ず以下のレポートを作成すること。**

#### **レポート作成が必須の場合**
- ✅ 大規模リファクタリング（複数ファイルに影響）
- ✅ フォルダ構成の変更
- ✅ 10ファイル以上の変更
- ✅ アーキテクチャの変更

#### **レポートテンプレート**
`docs/templates/REFACTORING_REPORT.md` を使用すること。

#### **レポート保存場所**
```
docs/refactoring-reports/YYYY-MM-DD_feature-name_description.md
```

#### **レポートに含めるべき内容**
1. 作業概要（目的・目標・範囲）
2. 変更サマリー（作成/変更/削除されたファイル）
3. ビフォー・アフター比較（行数、ファイル数、構造）
4. 改善点（保守性、パフォーマンス、テスト容易性）
5. テスト・動作確認結果
6. 影響範囲と今後の展望

#### **詳細ガイドライン**
詳細は [AI_GUIDELINES.md](./AI_GUIDELINES.md) を参照。

---

## 更新履歴
- **2025-10-19**: AI利用時のリファクタリングレポート作成を義務化（平林）
- **2025-10-19**: 実態に合わせて大幅改訂（平林）
  - Prettier未導入の事実を反映
  - 関数宣言スタイルを明確化（アロー関数推奨、関数宣言も許容）
  - import順序を詳細化（8段階）
  - PR単位を300行→500行に緩和、リファクタリング時の例外を追加
  - 定数命名規則を追加（UPPER_SNAKE_CASE）
  - コメント言語方針を追加（日本語OK）
  - TypeScript対応方針を追加
  - ブランチマージフローを追加
- **2025-10-19**: 初版作成（平林）
