# よくある質問（FAQ） — MOKU

このドキュメントは、開発中によく発生する問題と解決策をまとめたものです。

---

## 📋 目次
1. [Firebase Hostingに関する質問](#firebase-hostingに関する質問)
2. [環境変数に関する質問](#環境変数に関する質問)
3. [デプロイに関する質問](#デプロイに関する質問)
4. [チーム開発に関する質問](#チーム開発に関する質問)

---

## Firebase Hostingに関する質問

### **Q1: チームメンバーが自分のFirebaseプロジェクトの環境変数を使っているのに、なぜ私のFirebase Hostingのデプロイ履歴にその人のデプロイが記録されるのか？**

**A:** これは `.firebaserc` がGitで共有されていたために発生します。

#### **詳細な説明**

```
【問題の構造】
1. .firebaserc がGitリポジトリに含まれている
2. チームメンバーがリポジトリをクローン
3. .firebaserc に書かれた設定（あなたのプロジェクト）でデプロイ
4. メンバーの .env でビルドされたが、デプロイ先はあなたのプロジェクト
5. あなたのFirebase Hostingにメンバーのビルドがデプロイされる
```

#### **重要な理解**

**Firebase CLIの動作原理：**
- **デプロイ先（どこにデプロイするか）**: `.firebaserc` で決まる
- **ビルド内容（何をデプロイするか）**: `.env` で決まる

つまり：
- `.env` は「アプリがどのFirebaseプロジェクトに**接続**するか」を決める
- `.firebaserc` は「どのFirebaseプロジェクトに**デプロイ**するか」を決める

#### **具体例**

```javascript
// チームメンバーの .env
VITE_FIREBASE_PROJECT_ID=member-project-xxxxx  ← ビルド時に埋め込まれる

// チームメンバーの .firebaserc（Gitから取得）
{
  "default": "online-workspace-1c2a4"  ← あなたのプロジェクト
}

// デプロイコマンド実行
$ npm run deploy:dev
  ↓
1. ビルド: member-project-xxxxx の設定でビルド
2. デプロイ: online-workspace-1c2a4 にデプロイ
  ↓
結果: あなたのFirebase Hostingにメンバーのビルドがデプロイされる
```

#### **解決策**

`.firebaserc` を `.gitignore` に追加して、各メンバーが個別に管理する：

```bash
# .gitignore に追加
echo ".firebaserc" >> .gitignore

# 既存の .firebaserc を Git から削除（ファイル自体は残す）
git rm --cached .firebaserc
git commit -m "Remove .firebaserc from version control"
```

**関連ドキュメント**: [TEAM_DEVELOPMENT.md](./TEAM_DEVELOPMENT.md)

---

### **Q2: `.firebaserc` を `.gitignore` に追加して、それぞれが異なるdev環境のURL名を使えば、この問題は起こらなくなるのか？**

**A:** はい、その通りです。完全に解決できます。

#### **理由**

各メンバーが `.firebaserc` を個別に管理することで：

1. **デプロイ先の分離**
   ```json
   // あなたの .firebaserc
   {
     "default": "online-workspace-1c2a4",
     "targets": {
       "online-workspace-1c2a4": {
         "hosting": {
           "dev": ["online-workspace-dev-kenta"]  ← 個別のサイト名
         }
       }
     }
   }

   // チームメンバーの .firebaserc
   {
     "default": "member-project-xxxxx",  ← 別のプロジェクト
     "targets": {
       "member-project-xxxxx": {
         "hosting": {
           "dev": ["online-workspace-dev-member"]  ← 別のサイト名
         }
       }
     }
   }
   ```

2. **デプロイの完全分離**
   - あなた: `online-workspace-1c2a4` プロジェクトの `online-workspace-dev-kenta` にデプロイ
   - メンバー: `member-project-xxxxx` プロジェクトの `online-workspace-dev-member` にデプロイ
   - デプロイ履歴が混在しない ✅

3. **環境変数とデプロイ先の一致**
   - `.env` のプロジェクトと `.firebaserc` のプロジェクトが一致
   - ビルド内容とデプロイ先が整合性を持つ ✅

#### **実装後の動作**

```
【あなた】
.env: online-workspace-1c2a4
.firebaserc: online-workspace-1c2a4 / online-workspace-dev-kenta
  ↓
デプロイ先: https://online-workspace-dev-kenta.web.app/
接続先Firebase: online-workspace-1c2a4
  ↓
正常に動作 ✅

【チームメンバー】
.env: member-project-xxxxx
.firebaserc: member-project-xxxxx / online-workspace-dev-member
  ↓
デプロイ先: https://online-workspace-dev-member.web.app/
接続先Firebase: member-project-xxxxx
  ↓
正常に動作 ✅（ただし、データは分離される）
```

#### **注意点**

もしチーム全員で**同じデータベースを共有したい**場合は：

1. 全員が同じFirebaseプロジェクトを使用（`.env` を統一）
2. `.firebaserc` の `default` プロジェクトも統一
3. ただし、`dev` サイト名は個別にする

```json
// 全員が同じ .env
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4

// 個別の .firebaserc（プロジェクトは同じ、サイト名は個別）
{
  "default": "online-workspace-1c2a4",  ← 全員同じ
  "targets": {
    "online-workspace-1c2a4": {
      "hosting": {
        "dev": ["online-workspace-dev-yourname"]  ← 個別
      }
    }
  }
}
```

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - 推奨する開発環境構成](./TEAM_DEVELOPMENT.md#推奨する開発環境構成)

---

### **Q3: Firebase Hostingのサイト名は世界で一つしか存在できないのか？**

**A:** はい、その通りです。

Firebase Hostingのサイト名（例：`online-workspace-dev`）は**グローバルにユニーク**です。

```
例: online-workspace-dev.web.app
  ↓
この名前は世界中で唯一のサイトを指す
複数のFirebaseプロジェクトから同じ名前を使うことはできない
```

#### **重要な仕様**

1. **サイト名の所有権**
   - 最初に作成した人/プロジェクトに所属する
   - 他のプロジェクトから同じ名前を使おうとするとエラーになる

2. **デプロイの上書き**
   - 同じサイトに対して `firebase deploy` を実行すると、前のデプロイが完全に上書きされる
   - 前のデプロイ内容は削除され、新しい内容に置き換わる

3. **複数プロジェクトからの使用**
   - 基本的には不可能
   - ただし、同じFirebaseプロジェクトのメンバーであれば、複数人がデプロイ可能

---

## 環境変数に関する質問

### **Q4: `.env` ファイルはGitにコミットすべきか？**

**A:** いいえ、`.env` ファイルは**絶対にGitにコミットしてはいけません**。

#### **理由**

1. **セキュリティリスク**
   - APIキーやシークレットキーが公開される
   - 悪意のある第三者に悪用される可能性

2. **環境の柔軟性**
   - 各メンバーが異なる環境（開発、ステージング、本番）を使える
   - ローカル開発と本番環境で異なる設定を使える

3. **チーム開発の柔軟性**
   - メンバーごとに異なるFirebaseプロジェクトを使える
   - テスト用の環境を個別に作成できる

#### **推奨する方法**

```bash
# .gitignore に追加（既に追加済み）
.env
.env.local
.env.*.local

# .env.example をGitで管理（テンプレートとして）
.env.example  ← 実際の値は含まない
```

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - ベストプラクティス](./TEAM_DEVELOPMENT.md#ベストプラクティス)

---

### **Q5: `.env` と `.firebaserc` の違いは何か？**

**A:** 役割が全く異なります。

| ファイル | 役割 | 影響範囲 | Git管理 |
|---------|------|---------|---------|
| `.env` | **ビルド時**にアプリに埋め込まれる設定 | アプリが**どのFirebaseに接続するか** | ❌ しない |
| `.firebaserc` | **デプロイ時**にFirebase CLIが読む設定 | **どのFirebaseにデプロイするか** | ❌ しない（推奨） |

#### **具体例**

```javascript
// .env の内容（ビルド時に使用）
VITE_FIREBASE_PROJECT_ID=my-project

// ビルド後のコード
const firebaseConfig = {
  projectId: "my-project",  // ← .env から埋め込まれる
};

// .firebaserc の内容（デプロイ時に使用）
{
  "default": "deploy-target-project"  // ← デプロイ先
}

// 結果
アプリは "my-project" に接続しようとするが、
"deploy-target-project" にデプロイされる
→ 不整合が発生する可能性 ⚠️
```

#### **ベストプラクティス**

`.env` のプロジェクトと `.firebaserc` のプロジェクトを一致させる：

```bash
# .env
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4

# .firebaserc
{
  "default": "online-workspace-1c2a4"  ← 一致させる
}
```

---

## デプロイに関する質問

### **Q6: デプロイ前に確認すべきことは？**

**A:** 以下のチェックリストを実行してください。

#### **デプロイ前のチェックリスト**

- [ ] `.env` ファイルが正しいプロジェクトを指している
- [ ] `.firebaserc` のサイト名が自分専用のものである
- [ ] `.env` と `.firebaserc` のプロジェクトが一致している
- [ ] `npm run lint` が通る
- [ ] `npm run build:dev` が成功する
- [ ] ローカル環境で動作確認済み

```bash
# デプロイ前の確認コマンド
npm run lint
npm run build:dev

# プレビューデプロイで確認（推奨）
firebase hosting:channel:deploy preview

# 本デプロイ
npm run deploy:dev
```

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - デプロイ前のチェックリスト](./TEAM_DEVELOPMENT.md#デプロイ前のチェックリスト)

---

### **Q7: デプロイ後に画面が白い場合の対処法は？**

**A:** 以下の手順で確認してください。

#### **原因1: 環境変数の不一致**

```bash
# 確認方法
cat .env | grep VITE_FIREBASE_PROJECT_ID

# 期待される値
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4
```

**解決策**: `.env` を正しい値に修正して再ビルド・再デプロイ

```bash
npm run build:dev
npm run deploy:dev
```

#### **原因2: Firestoreのデータが空**

ブラウザのコンソールでエラーを確認：
```
例: "Missing or insufficient permissions"
```

**解決策**: Firebase ConsoleでFirestore Rulesを確認

#### **原因3: ビルドエラー**

```bash
# ビルドログを確認
npm run build:dev
```

**解決策**: エラーメッセージに従ってコードを修正

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - トラブルシューティング](./TEAM_DEVELOPMENT.md#トラブルシューティング)

---

## チーム開発に関する質問

### **Q8: 新しいメンバーが参加する場合、何をすればいいか？**

**A:** 以下の手順でセットアップしてください。

1. Firebaseプロジェクトへの招待を受ける
2. リポジトリをクローン
3. `.env` ファイルを作成（プロジェクトオーナーから値を取得）
4. 個別の開発サイトを作成
5. `.firebaserc` を設定
6. WebSocketサーバーのCORS設定を更新
7. デプロイ

**詳細手順**: [TEAM_DEVELOPMENT.md - セットアップ手順](./TEAM_DEVELOPMENT.md#セットアップ手順)

---

### **Q9: 他のメンバーのデプロイで自分のアプリが消えた場合の対処法は？**

**A:** すぐに再デプロイしてください。

```bash
# あなたのプロジェクトで再デプロイ
npm run deploy:dev
```

#### **根本的な解決策**

1. `.firebaserc` を `.gitignore` に追加
2. 各メンバーが個別のサイト名を使用
3. デプロイ前にサイト名を確認する習慣をつける

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - よくある問題](./TEAM_DEVELOPMENT.md#よくある問題と原因)

---

### **Q10: チーム全員で同じデータベースを共有したい場合は？**

**A:** 全員が同じFirebaseプロジェクトを使用してください。

#### **推奨構成**

```
【全員共通】
- Firebaseプロジェクト: online-workspace-1c2a4
- .env の内容: 同じ

【個別】
- デプロイサイト名: online-workspace-dev-yourname（個別）
- .firebaserc: 各自で管理
```

#### **設定例**

```bash
# 全員が同じ .env
VITE_FIREBASE_PROJECT_ID=online-workspace-1c2a4
VITE_FIREBASE_API_KEY=共通のAPIキー
# ...

# 個別の .firebaserc
{
  "default": "online-workspace-1c2a4",  ← 全員同じ
  "targets": {
    "online-workspace-1c2a4": {
      "hosting": {
        "dev": ["online-workspace-dev-kenta"]  ← 個別
      }
    }
  }
}
```

この構成により：
- ✅ データベースは共有される
- ✅ デプロイは個別に管理される
- ✅ デプロイの競合が発生しない

**関連ドキュメント**: [TEAM_DEVELOPMENT.md - 推奨する開発環境構成](./TEAM_DEVELOPMENT.md#推奨する開発環境構成)

---

## 参考資料

### **関連ドキュメント**
- [TEAM_DEVELOPMENT.md](./TEAM_DEVELOPMENT.md) - チーム開発ガイド（詳細）
- [tech-stack.md](./tech-stack.md) - 技術スタック
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ設計

### **外部リソース**
- [Firebase Hosting公式ドキュメント](https://firebase.google.com/docs/hosting)
- [Vite環境変数](https://vitejs.dev/guide/env-and-mode.html)
- [Firebase CLI リファレンス](https://firebase.google.com/docs/cli)

---

**最終更新:** 2025-10-19  
**更新者:** AI (Cursor Agent)

