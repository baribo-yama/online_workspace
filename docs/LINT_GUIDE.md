# Lintガイド — MOKU

**初心者でもわかる、ESLintの完全ガイド**

このドキュメントは、Lintの基礎知識から実践的な使い方、エラー修正方法までを網羅したガイドです。

---

## 📋 目次
1. [Lintとは](#lintとは)
2. [このプロジェクトのLint設定](#このプロジェクトのlint設定)
3. [基本的な使い方](#基本的な使い方)
4. [エラーの読み方](#エラーの読み方)
5. [エラーの種類と修正方法](#エラーの種類と修正方法)
6. [よくある質問](#よくある質問)

---

## Lintとは

### **簡単に言うと**

**Lint = コードの「文法チェッカー」や「スペルチェック」**

Wordで文章を書くと：
- 🔴 赤い波線：スペルミス
- 🔵 青い波線：文法ミス
- 🟢 緑の波線：スタイルの提案

Lintも同じように：
- 🔴 エラー：絶対に修正すべき問題
- 🟡 警告：修正を推奨する問題

---

### **なぜLintが必要？**

#### **理由1: バグの早期発見**
```javascript
// バグの例
const userName = "田中";
const age = 25;
// ↑ age を定義したが使っていない

// Lint がないと...
→ コードが実行されるまで気づかない
→ 無駄な変数がコードに残る

// Lint があると...
→ すぐに「age が使われていないよ！」と教えてくれる
→ バグを未然に防げる
```

#### **理由2: コード品質の統一**
```javascript
// Aさんのコード
const name="田中"

// Bさんのコード
const name = "鈴木";

// Lintがあると...
→ 「= の前後にスペースを入れて」と統一できる
→ チーム全体で同じスタイルになる
```

#### **理由3: ベストプラクティスの強制**
```javascript
// 悪い例（Lintが警告）
useEffect(() => {
  fetchData();
}, []); // ← fetchData が依存配列にない！潜在的バグ

// 良い例
useEffect(() => {
  fetchData();
}, [fetchData]); // ← 正しい依存配列
```

---

## このプロジェクトのLint設定

### **使用しているツール**

```
ツール: ESLint 9.33.0
設定ファイル: eslint.config.js
対象: src/ 配下の全 .js/.jsx ファイル
除外: dist/, server/, test-websocket-server.js
```

### **有効なルール**

```javascript
// eslint.config.js
extends: [
  js.configs.recommended,              // JavaScript 推奨ルール
  reactHooks.configs['recommended-latest'], // React Hooks ルール
  reactRefresh.configs.vite,           // Vite 用ルール
],

rules: {
  'no-unused-vars': ['error', { 
    varsIgnorePattern: '^[A-Z_]'  // 大文字で始まる変数は許可
  }],
}
```

### **チェック対象**

```
✅ チェックされる:
- src/**/*.js
- src/**/*.jsx

❌ チェックされない:
- dist/（ビルド出力）
- server/（Node.jsコード）
- node_modules/（外部ライブラリ）
- test-websocket-server.js
```

---

## 基本的な使い方

### **コマンド1: 全ファイルをチェック**

```bash
# 全ファイルを一括チェック
npm run lint

# 結果の例
✖ 27 problems (23 errors, 4 warnings)
# ↑ 27個の問題（エラー23個、警告4個）
```

### **コマンド2: 特定のファイルだけチェック**

```bash
# 特定のファイルのみ
npx eslint src/features/collaboration/hooks/useParticipants.js

# 特定のディレクトリのみ
npx eslint src/features/study-room/
```

### **コマンド3: 自動修正（一部のエラー）**

```bash
# 自動修正可能なエラーを自動で修正
npx eslint --fix .

# 注意: 全てのエラーが自動修正できるわけではない
```

---

## エラーの読み方

### **基本的な形式**

```
C:\Users\kenta\Desktop\100プロ\online_workspace\src\features\collaboration\hooks\useParticipants.js
  46:10  error  'db' is defined but never used. Allowed unused vars must match /^[A-Z_]/u  no-unused-vars
  ^^^    ^^^    ^^^                                                                        ^^^
  1      2      3                                                                          4
```

#### **1. ファイルパス**
```
src\features\collaboration\hooks\useParticipants.js
↑ エラーがあるファイル
```

#### **2. 行:列**
```
46:10
↑  ↑
行  列（文字位置）

46行目の10文字目にエラーがある
```

#### **3. 種類とメッセージ**
```
error  'db' is defined but never used
^^^    ^^^
種類    メッセージ

error: エラー（必ず修正すべき）
warning: 警告（修正推奨）
```

#### **4. ルール名**
```
no-unused-vars
↑ このルールに違反している

ルール名で検索すると、詳細な説明が見つかる
```

---

## エラーの種類と修正方法

### **カテゴリ1: 未使用変数（7個）** 🟡

#### **エラー例**
```
src/features/collaboration/hooks/useParticipants.js
  46:10  error  'db' is defined but never used
```

#### **原因**
```javascript
// useParticipants.js (46行目)
import { db, getRoomsCollection } from "../../../shared/services/firebase";
//       ^^^ インポートしているが使っていない
```

#### **修正方法**

**方法1: 削除する（推奨）**
```javascript
// 修正前
import { db, getRoomsCollection } from "../../../shared/services/firebase";

// 修正後
import { getRoomsCollection } from "../../../shared/services/firebase";
```

**方法2: 大文字で始める（将来使う予定がある場合）**
```javascript
// 修正前
import { db, getRoomsCollection } from "../../../shared/services/firebase";

// 修正後
import { DB, getRoomsCollection } from "../../../shared/services/firebase";
// ↑ 大文字で始めると ESLint が「定数」と判断して許可
```

**方法3: ESLintコメントで無視（非推奨）**
```javascript
// eslint-disable-next-line no-unused-vars
import { db, getRoomsCollection } from "../../../shared/services/firebase";
```

---

### **カテゴリ2: React Hooks警告（4個）** 🟠

#### **エラー例**
```
src/features/entertainment/hooks/useFaceObstacleGame.js
  85:6  warning  React Hook useEffect has a missing dependency: 'endGame'
```

#### **原因**
```javascript
// useFaceObstacleGame.js (85行目)
useEffect(() => {
  if (gameStatus === 'ended') {
    endGame(); // ← endGame を使っている
  }
}, [gameStatus]); // ← でも依存配列に endGame がない！
```

#### **なぜ問題？**
```javascript
// endGame が変更されても useEffect が再実行されない
// → 古い endGame 関数を使い続ける
// → 潜在的なバグの原因
```

#### **修正方法**

**方法1: 依存配列に追加（基本）**
```javascript
// 修正前
useEffect(() => {
  if (gameStatus === 'ended') {
    endGame();
  }
}, [gameStatus]);

// 修正後
useEffect(() => {
  if (gameStatus === 'ended') {
    endGame();
  }
}, [gameStatus, endGame]); // ← 追加
```

**方法2: useCallback でメモ化（推奨）**
```javascript
// endGame を useCallback でメモ化
const endGame = useCallback(() => {
  // ゲーム終了処理
  setGameStatus('idle');
  // ...
}, []); // 依存配列を適切に設定

// useEffect で使用
useEffect(() => {
  if (gameStatus === 'ended') {
    endGame();
  }
}, [gameStatus, endGame]); // ← これで安全
```

**注意: 無限ループに注意**
```javascript
// 危険な例
const endGame = () => { /* ... */ }; // 毎回新しい関数が生成される

useEffect(() => {
  endGame();
}, [endGame]); // ← 無限ループの可能性！

// 安全な例
const endGame = useCallback(() => {
  /* ... */
}, []); // メモ化

useEffect(() => {
  endGame();
}, [endGame]); // ← 安全
```

---

### **カテゴリ3: プロトタイプメソッド（1個）** 🔴

#### **エラー例**
```
src/shared/services/firestore.js
  118:40  error  Do not access Object.prototype method 'hasOwnProperty' from target object
```

#### **原因**
```javascript
// firestore.js (118行目)
export const validateTimerState = (timer) => {
  const required = ['timeLeft', 'isRunning', 'mode', 'cycle'];
  return required.every(field => timer.hasOwnProperty(field));
  //                             ^^^^^^^^^^^^^^^^^^^
  //                             非推奨の書き方
};
```

#### **なぜ問題？**

セキュリティリスク（プロトタイプ汚染攻撃）の可能性

```javascript
// 悪意のあるコード
const timer = { hasOwnProperty: () => true };
// ↑ hasOwnProperty が上書きされている

timer.hasOwnProperty('timeLeft'); // ← 常に true を返す（危険）
```

#### **修正方法**

**方法1: Object.hasOwn() を使用（最新・推奨）**
```javascript
// 修正前
return required.every(field => timer.hasOwnProperty(field));

// 修正後（ES2022以降）
return required.every(field => Object.hasOwn(timer, field));
```

**方法2: Object.prototype.hasOwnProperty.call() を使用（互換性重視）**
```javascript
// 修正後（古いブラウザ対応）
return required.every(field => 
  Object.prototype.hasOwnProperty.call(timer, field)
);
```

---

### **カテゴリ4: 環境設定の問題（11個）** 🟢

#### **エラー例**
```
server/server.js
  2:19  error  'require' is not defined  no-undef
  7:14  error  'process' is not defined  no-undef
```

#### **原因**

```javascript
// server/server.js
const WebSocket = require('ws'); // ← Node.jsコード
const PORT = process.env.PORT;   // ← Node.jsのグローバル変数

// しかし、ESLintの設定がブラウザ環境を想定している
// → require や process を「未定義」と判断
```

#### **修正方法**

**eslint.config.js を更新:**
```javascript
// eslint.config.js
export default defineConfig([
  globalIgnores(['dist', 'server', 'test-websocket-server.js']),
  // ↑ server/ を追加
  {
    files: ['**/*.{js,jsx}'],
    // ... 既存の設定
  },
])
```

**効果:**
- server/ フォルダの11個のエラーが即座に消える
- フロントエンドのコードのみがチェックされる

---

## よくある質問

### **Q1: Lintエラーがあってもアプリは動くの？**

**A: はい、動きます。**

```
Lintエラー ≠ アプリが動かない

【Lintエラーがあっても】
npm run dev        ← 動く ✅
npm run build:dev  ← 動く ✅
ブラウザで動作    ← 動く ✅

【ただし】
- 潜在的なバグがある可能性
- コード品質が低い
- チーム開発で問題が起きやすい
```

**推奨:** エラーがあっても動くが、修正した方が良い

---

### **Q2: 全部修正しないとダメ？**

**A: 優先度による。**

```
【必ず修正すべき（高優先度）】
🔴 error（エラー）
  - セキュリティ問題
  - バグの原因になるもの
  - React Hooks のルール違反

【修正推奨（中優先度）】
🟡 warning（警告）
  - 潜在的な問題
  - ベストプラクティス違反

【任意（低優先度）】
🟢 環境設定の問題
  - server/ の require エラーなど
  - eslint.config.js で除外可能
```

---

### **Q3: どの順番で修正すべき？**

**A: 以下の順番を推奨。**

```
Phase 1: 環境設定（5分）
  → eslint.config.js を更新
  → server/ を除外
  → 27個 → 16個

Phase 2: セキュリティ問題（15分）
  → プロトタイプメソッドの修正
  → 16個 → 15個

Phase 3: React Hooks警告（1時間）
  → 依存配列の修正
  → 15個 → 11個

Phase 4: 未使用変数（1時間）
  → インポートの削除
  → 11個 → 0個 ✅
```

詳細: `docs/QUICKSTART_REFACTORING.md` を参照

---

### **Q4: 自動で修正できる？**

**A: 一部は可能。**

```bash
# 自動修正を試す
npx eslint --fix .

# 自動修正できるエラー:
✅ インデントの修正
✅ スペースの調整
✅ セミコロンの追加/削除

# 自動修正できないエラー:
❌ 未使用変数の削除（手動で判断が必要）
❌ React Hooks の依存配列（ロジック理解が必要）
❌ プロトタイプメソッド（書き換えが必要）
```

**推奨:** 自動修正は補助的に使い、手動で確認しながら修正

---

### **Q5: Lintエラーを一時的に無視したい**

**A: 可能だが、推奨しない。**

#### **方法1: 特定の行を無視**
```javascript
// eslint-disable-next-line no-unused-vars
const unusedVar = "これは後で使う予定";
```

#### **方法2: ファイル全体を無視**
```javascript
/* eslint-disable no-unused-vars */

// このファイル全体で no-unused-vars を無視
const var1 = "test";
const var2 = "test";

/* eslint-enable no-unused-vars */
```

#### **方法3: ファイルを除外設定**
```javascript
// eslint.config.js
globalIgnores(['dist', 'server', 'specific-file.js'])
```

**注意:** 無視すると問題が蓄積するため、本当に必要な場合のみ使用

---

### **Q6: Lintエラーを修正したのに消えない**

**A: 以下を確認。**

```bash
# 1. ファイルを保存したか確認
# Ctrl + S で保存

# 2. Lintを再実行
npm run lint

# 3. キャッシュをクリア
rm -rf node_modules/.cache
npm run lint

# 4. VS Codeを再起動
```

---

## 実践的な修正フロー

### **ステップ1: エラーを確認**

```bash
npm run lint
```

### **ステップ2: エラーを分類**

```
27個のエラー
  ↓
カテゴリ別に分類:
- 環境設定: 11個（server/ 関連）
- 未使用変数: 7個
- React Hooks: 4個
- プロトタイプ: 1個
```

### **ステップ3: 優先順位を決定**

```
1. 環境設定（即座に解決）
2. セキュリティ（高優先度）
3. React Hooks（中優先度）
4. 未使用変数（低優先度）
```

### **ステップ4: 1つずつ修正**

```
1個修正
  ↓
npm run lint で確認
  ↓
エラーが減ったか確認
  ↓
次のエラーへ
```

### **ステップ5: 全て修正したら**

```bash
npm run lint
# ✓ No problems found

npm run build:dev
# ✓ ビルド成功

# 動作確認
npm run dev
# ✓ アプリが正常に動作
```

---

## エラー別修正例集

### **例1: 未使用変数**

```javascript
// エラー
import { useState, useEffect, useCallback } from 'react';
//                             ^^^^^^^^^^^
// useCallback を使っていない

// 修正
import { useState, useEffect } from 'react';
```

---

### **例2: React Hooks依存配列**

```javascript
// エラー
const [count, setCount] = useState(0);

const increment = () => {
  setCount(count + 1);
};

useEffect(() => {
  increment();
}, []); // ← increment がない

// 修正（方法1: 依存配列に追加）
useEffect(() => {
  increment();
}, [increment]);

// 修正（方法2: useCallback でメモ化）
const increment = useCallback(() => {
  setCount(prev => prev + 1);
}, []);

useEffect(() => {
  increment();
}, [increment]);
```

---

### **例3: プロトタイプメソッド**

```javascript
// エラー
if (obj.hasOwnProperty('key')) {
  // ...
}

// 修正
if (Object.hasOwn(obj, 'key')) {
  // ...
}
```

---

### **例4: console.log の警告**

```javascript
// 警告（本番環境では推奨されない）
console.log('デバッグ用');

// 修正（開発環境のみで実行）
if (import.meta.env.DEV) {
  console.log('デバッグ用');
}
```

---

## VS Code での Lint 活用

### **リアルタイムエラー表示**

VS Codeに ESLint 拡張機能をインストールすると：

```
ファイルを編集中に:
- 🔴 赤い波線: エラー
- 🟡 黄色い波線: 警告
- 💡 電球マーク: 修正提案

カーソルを合わせると:
→ エラーの詳細が表示される
→ クイックフィックスが提案される
```

### **推奨拡張機能**

```json
// .vscode/extensions.json（推奨）
{
  "recommendations": [
    "dbaeumer.vscode-eslint"
  ]
}
```

### **保存時の自動修正**

```json
// .vscode/settings.json（推奨）
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## トラブルシューティング

### **問題1: Lintエラーが大量に出る**

```
npm run lint
✖ 27 problems (23 errors, 4 warnings)

【対処法】
1. パニックにならない
2. カテゴリ別に分類
3. 優先順位を決める
4. 1つずつ確実に修正

詳細: @docs/QUICKSTART_REFACTORING.md
```

---

### **問題2: どこから修正すればいいかわからない**

```
【推奨フロー】
1. @docs/QUICKSTART_REFACTORING.md を開く
2. 「ステップ1: Lintエラーを全修正」をコピー
3. AIに指示
4. 3-4時間後にエラー0達成
```

---

### **問題3: 修正したらアプリが動かなくなった**

```bash
# 修正を元に戻す
git restore [ファイル名]

# または
git checkout HEAD -- [ファイル名]

# 原因を調査
npm run dev
# ブラウザコンソールでエラー確認
```

---

## チーム開発でのLint活用

### **Pull Request前のチェック**

```bash
# PRを出す前に必ず実行
npm run lint

# エラーがある場合
→ 全て修正してからPRを出す

# エラー0になったら
→ PRを作成
```

### **コミット前のチェック**

```bash
# コミット前
git add .
npm run lint  # ← エラーチェック
git commit -m "..."

# エラーがある場合
→ 修正してからコミット
```

### **CI/CD での活用（将来実装）**

```yaml
# .github/workflows/lint.yml（将来の例）
name: Lint Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run lint
```

---

## まとめ

### **Lintとは**
- コードの品質をチェックするツール
- バグを早期発見
- コードスタイルを統一

### **基本的な使い方**
```bash
npm run lint           # 全ファイルチェック
npx eslint --fix .     # 自動修正（一部）
```

### **修正の優先順位**
```
1. 環境設定（5分で11個解決）
2. セキュリティ（15分で1個解決）
3. React Hooks（1時間で4個解決）
4. 未使用変数（1時間で7個解決）
```

### **困ったら**
- `docs/QUICKSTART_REFACTORING.md` - すぐ使える指示
- `docs/refactoring-reports/2025-10-21_lint-error-fixes.md` - 詳細な修正計画
- `docs/FAQ.md` - よくある質問

---

## 関連ドキュメント

- [CODING_RULES.md](./CODING_RULES.md) - コーディング規約とLint設定
- [QUICKSTART_REFACTORING.md](./QUICKSTART_REFACTORING.md) - Lint修正の実践ガイド
- [AI_REFACTORING_WORKFLOW.md](./AI_REFACTORING_WORKFLOW.md) - Lint駆動リファクタリング手法
- [refactoring-reports/2025-10-21_lint-error-fixes.md](./refactoring-reports/2025-10-21_lint-error-fixes.md) - Lintエラー修正計画

---

**最終更新:** 2025-10-21  
**更新者:** AI (Cursor Agent)

