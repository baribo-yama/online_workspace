# チーム開発ガイド — MOKU

このドキュメントは、複数人でこのプロジェクトを開発する際の注意点とベストプラクティスをまとめたものです。

---

## 📋 目次
1. [Firebase Hostingの重要な仕様](#firebase-hostingの重要な仕様)
2. [よくある問題と原因](#よくある問題と原因)
3. [推奨する開発環境構成](#推奨する開発環境構成)
4. [セットアップ手順](#セットアップ手順)
5. [トラブルシューティング](#トラブルシューティング)

---

## Firebase Hostingの重要な仕様

### **1. サイト名のグローバルユニーク性**

Firebase Hostingのサイト名は**世界で1つしか存在できません**。

```
例: online-workspace-dev.web.app
  ↓
この名前は世界中で唯一のサイトを指す
複数のFirebaseプロジェクトから同じ名前を使うことはできない
```

### **2. デプロイの上書き動作**

同じサイトに対して `firebase deploy` を実行すると、**前のデプロイ内容が完全に上書き**されます。

```bash
# あなたがデプロイ
npm run deploy:dev
→ online-workspace-dev.web.app にデプロイ ✅

# チームメンバーが同じサイトにデプロイ
npm run deploy:dev
→ あなたのデプロイが完全に消えて、メンバーのデプロイに置き換わる ⚠️
```

### **3. 環境変数のビルド時埋め込み**

Viteは**ビルド時**に `.env` の内容を静的にバンドルします。

```javascript
// ビルド時に確定（ランタイムでは変更不可）
const firebaseConfig = {
  apiKey: "ビルド時の.envの値",
  projectId: "ビルド時の.envの値",
  // ...
};
```

**重要**: チームメンバーが異なる `.env` を使ってビルド→デプロイすると、異なるFirebaseプロジェクトに接続するアプリがデプロイされます。

---

## よくある問題と原因

### **問題1: チームメンバーがデプロイしたら、自分のアプリが白い画面になった**

#### **何が起こったのか**

```
【状況】
- あなた: Firebase Project A を使用、online-workspace-dev にデプロイ
- メンバー: Firebase Project B を使用、同じ online-workspace-dev にデプロイ

【結果】
URL: https://online-workspace-dev.web.app/
  → メンバーのビルド成果物に置き換わった
  → メンバーの .env の設定が埋め込まれている
  → Firebase Project B に接続しようとする
  → あなたのプロジェクトのデータは見えない
  → 画面が白飛びする
```

#### **原因の詳細**

1. **デプロイの上書き**: 同じサイト名を使ったため、あなたのデプロイが消された
2. **Firebaseプロジェクトの不一致**: メンバーの `.env` でビルドされたため、異なるプロジェクトに接続
3. **データの不在**: Project B には部屋データやFirestore Rulesが存在しない
4. **エラー処理**: データ取得失敗で白い画面が表示される

#### **即座の対処法**

```bash
# あなたのプロジェクトで再デプロイ
npm run deploy:dev
```

これで、あなたの設定に戻ります。

---

### **問題2: チームメンバーがなぜ同じサイトにデプロイできたのか？**

#### **最も可能性が高い理由：`.firebaserc` がGitで共有されていた**

```
【問題の構造】
1. .firebaserc がGitリポジトリに含まれていた
2. チームメンバーがリポジトリをクローン
3. .firebaserc に書かれた設定（あなたのプロジェクト）でデプロイ
4. メンバーの .env でビルドされたが、デプロイ先はあなたのプロジェクト
5. あなたのFirebase Hostingにメンバーのビルドがデプロイされた
```

**Firebase CLIの動作：**
- **デプロイ先は `.firebaserc` で決まる**（.env は関係ない）
- **ビルド内容は `.env` で決まる**（.firebaserc は関係ない）

#### **他の可能性のある理由**

##### **パターンA: 権限の共有**
- あなたとメンバーが同じFirebaseプロジェクトのメンバー
- メンバーもデプロイ権限を持っていた
- `.firebaserc` が共有されていたため、同じプロジェクトにデプロイされた

##### **パターンB: Firebase CLIの自動認証**
- メンバーが `firebase login` で認証
- あなたのプロジェクトへのアクセス権限を持っていた
- `.firebaserc` に従ってデプロイが実行された

##### **パターンC: サイトの再作成（可能性は低い）**
- メンバーが自分のプロジェクトで `firebase hosting:sites:create online-workspace-dev` を実行
- サイトが一度削除され、メンバーのプロジェクトで再作成された
- ただし、この場合はあなたのデプロイ履歴には残らない

---

## 推奨する開発環境構成

### **方法A: 個別開発サイトを使用（推奨）**

各メンバーが**異なるサイト名**を使用して、個別に開発します。

```
【共有Firebaseプロジェクト】
Project: online-workspace-1c2a4

【個別開発サイト】
- kenta: online-workspace-dev-kenta
  → https://online-workspace-dev-kenta.web.app/
- memberA: online-workspace-dev-memberA
  → https://online-workspace-dev-memberA.web.app/
- memberB: online-workspace-dev-memberB
  → https://online-workspace-dev-memberB.web.app/

【共有環境】
- ステージング: online-workspace-staging
  → https://online-workspace-staging.web.app/
- 本番: online-workspace-1c2a4
  → https://online-workspace-1c2a4.web.app/
```

#### **メリット**
- ✅ デプロイの競合が発生しない
- ✅ 各自が自由に開発・デプロイ可能
- ✅ 同じFirebaseプロジェクト（データ）を共有できる

#### **デメリット**
- ❌ 各自がサイトを作成する手間がある
- ❌ `.firebaserc` の管理が個別になる

---

### **方法B: プロジェクトを完全統一（本プロジェクトで採用）**

チーム全員が**同じFirebaseプロジェクトと同じ環境変数**を使用します。

**重要**: このプロジェクトでは、この方法を採用しています。
- `.firebaserc` を `.gitignore` に追加済み
- `.firebaserc.example` をテンプレートとして提供
- 各メンバーが個別の開発サイト名を使用

#### **構成**
```
【共有】
- Firebaseプロジェクト: online-workspace-1c2a4
- 環境変数 (.env): 全員同じ内容

【サイト名】
- 各自が異なる開発サイトを使用（方法Aと同じ）
```

#### **メリット**
- ✅ データベースが完全に同期
- ✅ 環境変数の管理が簡単
- ✅ 本番環境に近い状態でテスト可能

#### **デメリット**
- ❌ Firebaseプロジェクトの権限管理が必要
- ❌ 開発中のデータが混在する可能性

---

### **方法C: 個別Firebaseプロジェクト（非推奨）**

各メンバーが**自分のFirebaseプロジェクト**を使用します。

#### **構成**
```
- kenta: Project A (online-workspace-1c2a4)
- memberA: Project B (member-a-project-xxxxx)
- memberB: Project C (member-b-project-xxxxx)
```

#### **デメリット**
- ❌ データが共有されない
- ❌ サイト名の競合が発生しやすい
- ❌ 統合テストが困難

**推奨しません。**

---

## セットアップ手順

### **新しいメンバーが参加する場合**

#### **ステップ1: Firebaseプロジェクトに招待**

プロジェクトオーナーがFirebase Consoleで新メンバーを招待：

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `online-workspace-1c2a4` を選択
3. **⚙️ プロジェクトの設定** → **ユーザーと権限**
4. **メンバーを追加** → メールアドレスを入力
5. 役割: **編集者** または **オーナー**

#### **ステップ2: リポジトリをクローン**

```bash
git clone <repository-url>
cd online_workspace
npm install
```

#### **ステップ3: 環境変数を設定**

```bash
# .env ファイルを作成
cp .env.example .env

# .env を編集（プロジェクトオーナーから値を取得）
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=online-workspace-1c2a4.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4
VITE_FIREBASE_STORAGE_BUCKET=online-workspace-1c2a4.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_LIVEKIT_URL=your-livekit-url
```

#### **ステップ4: 個別開発サイトを作成**

```bash
# Firebase CLIにログイン
firebase login

# 自分専用の開発サイトを作成
firebase hosting:sites:create online-workspace-dev-yourname
```

#### **ステップ5: `.firebaserc` を設定**

`.firebaserc.example` をコピーして、自分用の設定を作成：

```bash
# テンプレートをコピー
cp .firebaserc.example .firebaserc

# .firebaserc を編集
```

**あなたの `.firebaserc` の内容：**

```json
{
  "projects": {
    "default": "online-workspace-1c2a4"
  },
  "targets": {
    "online-workspace-1c2a4": {
      "hosting": {
        "prod": [
          "online-workspace-1c2a4"
        ],
        "dev": [
          "online-workspace-dev-yourname"  ← 自分専用のサイト名
        ]
      }
    }
  },
  "etags": {}
}
```

**重要**: 
- `.firebaserc` は `.gitignore` に含まれているため、各自が個別に作成します
- `online-workspace-dev-yourname` の部分を自分の名前に変更してください
- サイト名は事前に作成（ステップ4）したものと一致させてください

#### **ステップ6: WebSocketサーバーのCORS設定を更新**

`server/server.js` を編集して、自分の開発サイトをCORSの許可リストに追加：

```javascript
const allowedOrigins = [
  'https://online-workspace-1c2a4.web.app',
  'https://online-workspace-1c2a4.firebaseapp.com',
  'https://online-workspace-dev-yourname.web.app',  // ← 追加
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5175'
];
```

**注意**: この変更は共有リポジトリにコミットしてください。

#### **ステップ7: 開発環境にデプロイ**

```bash
# ビルド
npm run build:dev

# デプロイ
npm run deploy:dev

# または、一括で実行
npm run deploy:dev
```

デプロイが成功したら、以下のURLでアクセス：
```
https://online-workspace-dev-yourname.web.app/
```

---

## ベストプラクティス

### **1. `.env` ファイルの管理**

#### **推奨構成**

```
【Gitで管理】
.env.example  ← テンプレート（実際の値は含まない）

【Gitで管理しない】
.env          ← 実際の環境変数（.gitignore に追加）
```

#### **`.env.example` の内容**

```bash
# Firebase設定
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain-here
VITE_FIREBASE_PROJECT_ID=your-project-id-here
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket-here
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id-here
VITE_FIREBASE_APP_ID=your-app-id-here

# LiveKit設定
VITE_LIVEKIT_URL=wss://your-livekit-url
```

#### **`.gitignore` に追加**

```gitignore
# 環境変数
.env
.env.local
.env.*.local

# Firebase設定（個人設定の場合）
.firebaserc
```

---

### **2. `.firebaserc` ファイルの管理**

#### **パターンA: Gitで管理しない（推奨）**

各メンバーが個別の `.firebaserc` を作成：

```bash
# .gitignore に追加
.firebaserc
```

**メリット**:
- デプロイ先の競合が発生しない
- 各自が自由に設定可能

**デメリット**:
- 新メンバーが手動で設定する必要がある

#### **パターンB: Gitで管理する**

共通の `.firebaserc` をリポジトリで管理：

```json
{
  "projects": {
    "default": "online-workspace-1c2a4"
  },
  "targets": {
    "online-workspace-1c2a4": {
      "hosting": {
        "prod": ["online-workspace-1c2a4"],
        "staging": ["online-workspace-staging"],
        "dev": ["online-workspace-dev-shared"]
      }
    }
  }
}
```

**メリット**:
- セットアップが簡単
- 共有環境の管理が容易

**デメリット**:
- 個別開発サイトの管理が難しい
- デプロイの競合が発生しやすい

---

### **3. デプロイ前のチェックリスト**

デプロイする前に、以下を確認してください：

- [ ] `.env` ファイルが正しいプロジェクトを指している
- [ ] `.firebaserc` のサイト名が自分専用のものである
- [ ] `npm run lint` が通る
- [ ] `npm run build:dev` が成功する
- [ ] ローカル環境で動作確認済み

```bash
# デプロイ前の確認コマンド
npm run lint
npm run build:dev
firebase hosting:channel:deploy preview  # プレビューデプロイで確認
```

---

### **4. ブランチ戦略**

#### **推奨ブランチ構成**

```
main (本番環境)
  └─ develop (ステージング環境)
      ├─ feature/member-a-feature
      ├─ feature/member-b-feature
      └─ bugfix/some-bug
```

#### **デプロイフロー**

```
【個人開発】
feature/xxx ブランチ
  ↓ npm run deploy:dev (個別サイトへ)
  ↓ 動作確認
  ↓ プルリクエスト作成

【ステージング】
develop ブランチ
  ↓ マージ後
  ↓ npm run deploy:staging
  ↓ チーム全体でテスト

【本番】
main ブランチ
  ↓ マージ後
  ↓ npm run deploy:prod
  ↓ 本番リリース
```

---

## トラブルシューティング

### **問題: デプロイ後に画面が白い**

#### **原因1: 環境変数の不一致**

```bash
# 確認方法
cat .env | grep VITE_FIREBASE_PROJECT_ID

# 期待される値
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4
```

**解決策**: `.env` を正しい値に修正して再ビルド・再デプロイ

#### **原因2: Firestoreのデータが空**

```javascript
// ブラウザのコンソールでエラーを確認
// 例: "Missing or insufficient permissions"
```

**解決策**: Firebase ConsoleでFirestore Rulesを確認

#### **原因3: ビルドエラー**

```bash
# ビルドログを確認
npm run build:dev
```

**解決策**: エラーメッセージに従ってコードを修正

---

### **問題: 他のメンバーのデプロイで自分のアプリが消えた**

#### **確認方法**

```bash
# 現在のデプロイ先を確認
cat .firebaserc | grep "dev"
```

#### **解決策**

```bash
# 1. 自分専用のサイト名に変更
# .firebaserc を編集

# 2. 再デプロイ
npm run deploy:dev
```

---

### **問題: `firebase deploy` でエラーが出る**

#### **エラー例1: 権限エラー**

```
Error: HTTP Error: 403, The caller does not have permission
```

**解決策**: プロジェクトオーナーに招待してもらう

#### **エラー例2: サイトが存在しない**

```
Error: Cannot find Hosting site online-workspace-dev-yourname
```

**解決策**:

```bash
# サイトを作成
firebase hosting:sites:create online-workspace-dev-yourname

# .firebaserc を確認・更新
```

#### **エラー例3: プロジェクトが見つからない**

```
Error: No project active
```

**解決策**:

```bash
# プロジェクトを設定
firebase use online-workspace-1c2a4

# または .firebaserc を作成
```

---

### **問題: LiveKitに接続できない**

#### **確認事項**

1. `.env` の `VITE_LIVEKIT_URL` が正しい
2. LiveKitサーバーが稼働している
3. トークン生成ロジックが正しい

#### **デバッグ方法**

```javascript
// ブラウザのコンソールで確認
console.log(import.meta.env.VITE_LIVEKIT_URL);
```

---

### **問題: WebSocketサーバーに接続できない**

#### **確認事項**

1. `server/server.js` の `allowedOrigins` に自分のサイトが含まれている
2. WebSocketサーバーが稼働している（Render）

#### **解決策**

```javascript
// server/server.js
const allowedOrigins = [
  // ... 既存の設定
  'https://online-workspace-dev-yourname.web.app',  // ← 追加
];
```

この変更をコミット・プッシュして、WebSocketサーバーを再デプロイ。

---

## 参考資料

### **関連ドキュメント**
- [Firebase Hosting公式ドキュメント](https://firebase.google.com/docs/hosting)
- [Vite環境変数](https://vitejs.dev/guide/env-and-mode.html)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ設計
- [tech-stack.md](./tech-stack.md) - 技術スタック

### **Firebase CLI コマンド**

```bash
# ログイン
firebase login

# プロジェクト一覧
firebase projects:list

# プロジェクトを選択
firebase use <project-id>

# サイト一覧
firebase hosting:sites:list

# サイト作成
firebase hosting:sites:create <site-name>

# デプロイ
firebase deploy --only hosting:dev

# デプロイ履歴
firebase hosting:channel:list
```

---

## まとめ

### **チーム開発で最も重要なこと**

1. **個別の開発サイトを使用する**
   - サイト名の競合を避ける
   - デプロイの上書きを防ぐ

2. **環境変数を統一する**
   - 全員が同じFirebaseプロジェクトを使用
   - `.env` の内容をチームで共有

3. **デプロイ前に確認する**
   - `.firebaserc` のサイト名を確認
   - ビルド・Lintを実行
   - プレビューデプロイで動作確認

4. **コミュニケーションを取る**
   - デプロイ前にチームに通知
   - 問題が発生したらすぐに報告
   - ドキュメントを最新に保つ

---

**最終更新:** 2025-10-19  
**更新者:** AI (Cursor Agent)

