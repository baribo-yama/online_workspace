# ARCHITECTURE.md — MOKU

## 目的
このドキュメントは、MOKUのソース構造と責務分担の方針を定義する。  
feature-based architecture を採用し、**UIとロジックを分離**し、拡張・修正を容易にする。

---

## ディレクトリ構成（現行）
src/
├── App.jsx                          # メインアプリケーションコンポーネント
├── main.jsx                         # エントリーポイント
├── index.css
├── globals.css
│
├── features/                        # 機能別モジュール
│   │
│   ├── collaboration/               # コラボレーション機能
│   │   ├── components/
│   │   │   └── ParticipantList.jsx
│   │   ├── hooks/
│   │   │   └── useParticipants.js
│   │   └── index.js
│   │
│   ├── entertainment/               # エンターテイメント機能
│   │   ├── components/
│   │   │   └── FaceObstacleGame.jsx
│   │   ├── hooks/
│   │   │   ├── useFaceObstacleGame.js
│   │   │   └── useNotification.js
│   │   └── index.js
│   │
│   ├── study-room/                  # 自習室機能 
│   │   ├── components/
│   │   │   ├── GameOverlay.jsx
│   │   │   ├── HomePage.jsx        
│   │   │   ├── RoomHeader.jsx
│   │   │   └── RoomPage.jsx
│   │   ├── hooks/
│   │   │   ├── useRoomActions.js
│   │   │   └── useRoomData.js
│   │   ├── constants.js
│   │   ├── DEPENDENCIES.md
│   │   ├── README.md
│   │   └── index.js
│   │
│   ├── timer/                       # タイマー機能
│   │   ├── components/
│   │   │   ├── EnhancedPomodoroTimer.jsx
│   │   │   ├── PersonalTimer.jsx
│   │   │   └── SharedTimer.jsx
│   │   ├── hooks/
│   │   │   ├── usePersonalTimer.js
│   │   │   └── useSharedTimer.js
│   │   └── index.js
│   │
│   └── video-call/                  # ビデオ通話機能
│       ├── components/
│       │   └── VideoCallRoom.jsx
│       ├── config/
│       │   └── livekit.js
│       └── index.js
│
└── shared/                          # 共有モジュール
    ├── config/
    │   └── websocket.js
    ├── services/
    │   ├── firebase.js
    │   └── firestore.js
    └── utils/
        └── timer.js

---

## 設計思想

### 1. Feature-Based Architecture
- 各機能（feature）は、**独立したミニモジュール**として設計する。  
- 他の feature に直接依存せず、共通処理は `utils/` 経由で呼び出す。  
- 各 feature 内に `README.md` を置き、実装の意図や使用例を簡潔に記載する。  

### 2. 責務分離の原則
| ファイル / フォルダ | 役割 |
|----------------------|------|
| `components/` | UI層。画面描画とユーザー操作の受付のみ担当。状態管理や外部通信を含めない。 |
| `hooks/` | 状態・副作用の制御を行うロジック層。`useSomething` 命名で統一。 |
| `config/` | 固定設定・接続情報・初期化ロジック。現在は `video-call` のみ使用。 |
| `constants.js` | feature 内でのみ使用する定数群。グローバルに影響しない。 |
| `index.js` | その feature が提供する主要エクスポートをまとめる。 |
| `README.md` | 機能の概要、依存関係、使用例を簡潔に記載。 |

---

## 命名規則・運用ルール

- ファイル名は **camelCase**、コンポーネントは **PascalCase**。  
- カスタムフックは **`use`** で始める（例：`useTimer.js`）。  
- 各 feature の `index.js` には外部に公開するモジュールのみをエクスポートする。  
- 1ファイルが 200 行を超えた場合、責務単位で分割する。  
- ロジックを伴う JSX は hooks 側に移し、UI コンポーネントはプレゼンテーション専用にする。  

---

## utils の扱い
- 複数の feature で再利用される処理は `utils/` にまとめる。  
- グローバル定数やバリデーション関数など、アプリ全体に影響するロジックを配置。  
- `utils/constants.js` の定数は他の feature による上書きを禁止。  

---

## feature 内 README.md テンプレート

各 feature には README を配置し、以下のテンプレートに従う。  
**目的**: 新規参加者やAIが機能を理解し、適切に保守・拡張できるようにする。

```markdown
# [Feature Name]（日本語名）

## 📝 概要
この機能が解決する問題と実現する価値を2〜3文で説明。

**主要機能:**
- 機能1の説明
- 機能2の説明
- 機能3の説明

---

## 📁 ディレクトリ構造

\`\`\`
src/features/[feature-name]/
├── components/
│   ├── MainComponent.jsx       # メインコンポーネント - XX行
│   ├── SubComponent1.jsx       # サブコンポーネント1 - XX行
│   └── SubComponent2.jsx       # サブコンポーネント2 - XX行
├── hooks/
│   ├── useFeatureData.js       # データ取得ロジック - XX行
│   └── useFeatureActions.js    # 操作ロジック - XX行
├── constants.js                # 定数定義 - XX行
├── README.md                   # このファイル
└── index.js                    # エクスポート
\`\`\`

**合計: Xファイル / 約XXX行**

---

## 🎯 責務の分離

### **📄 components/** - UIコンポーネント
- **MainComponent.jsx**: 機能の説明（役割、何を表示するか）
- **SubComponent1.jsx**: 機能の説明
- **SubComponent2.jsx**: 機能の説明

### **🔧 hooks/** - ロジック層
- **useFeatureData.js**: データ取得、リアルタイム監視、状態管理
- **useFeatureActions.js**: ユーザー操作、バリデーション、副作用処理

### **📊 constants.js** - 定数
- 制限値（上限、タイムアウトなど）
- エラーメッセージ
- デフォルト値

---

## 🔄 データフロー

\`\`\`
[外部データソース] → useFeatureData → MainComponent
                                            ↓
                                    SubComponents
                                            ↓
                      ユーザー操作 → useFeatureActions → [外部への副作用]
\`\`\`

**詳細:**
1. `useFeatureData` がFirestore/APIからデータを取得
2. 取得したデータをコンポーネントに渡す
3. ユーザー操作は `useFeatureActions` で処理
4. 必要に応じて外部に更新を反映

---

## 🔗 依存関係

### **内部依存（プロジェクト内）:**
- `@/shared/services/firebase` - Firestore操作
- `@/shared/utils/xxx` - ユーティリティ関数
- `@/features/xxx` - 他機能との連携（あれば）

### **外部依存（ライブラリ）:**
- `react` - UIフレームワーク
- `firebase/firestore` - データベース
- `lucide-react` - アイコン（例）
- その他...

---

## 💡 使用方法

### **基本的な使い方**

\`\`\`javascript
import { MainComponent } from '@/features/[feature-name]';

function App() {
  return <MainComponent userId="123" />;
}
\`\`\`

### **hooks を再利用する場合**

\`\`\`javascript
import { useFeatureData, useFeatureActions } from '@/features/[feature-name]';

function CustomComponent() {
  const { data, loading } = useFeatureData(id);
  const { handleAction } = useFeatureActions(id);

  // 独自のUIで同じロジックを使用
  return <div onClick={handleAction}>{data.title}</div>;
}
\`\`\`

### **定数を使用する場合**

\`\`\`javascript
import { FEATURE_LIMITS, FEATURE_ERRORS } from '@/features/[feature-name]';

if (count > FEATURE_LIMITS.MAX_COUNT) {
  alert(FEATURE_ERRORS.LIMIT_EXCEEDED);
}
\`\`\`

---

## ⚠️ 注意点・制約事項

### **重要な制約:**
- 制約1の説明（例: 最大同時接続数は5まで）
- 制約2の説明（例: ホスト権限は作成者のみ）

### **hooksの依存関係:**
- `useFeatureActions` は `xxx` を引数で受け取る必要がある
- `useFeatureData` は自動的にクリーンアップされる（unsubscribe）

### **パフォーマンス上の注意:**
- 大量のデータを扱う場合は `React.memo` を検討
- リアルタイム更新を使用しているため、過度な再レンダリングに注意

---

## 🚀 今後の拡張方針

### **短期的な改善案:**
- [ ] 機能Aの追加
- [ ] パフォーマンス最適化
- [ ] エラーハンドリングの強化

### **長期的な展望:**
- [ ] TypeScript化
- [ ] 単体テストの追加
- [ ] アクセシビリティ対応

### **拡張例: 新機能を追加する場合**

\`\`\`javascript
// MainComponent.jsx
import { NewFeature } from '@/features/new-feature';

export function MainComponent() {
  return (
    <div>
      {/* 既存のコンポーネント */}
      <ExistingComponent />
      
      {/* 🆕 新機能追加（既存コードに影響なし） */}
      <NewFeature />
    </div>
  );
}
\`\`\`

---

## 🐛 既知の問題・バグ修正履歴

### **修正済み:**
- ✅ [日付] バグの説明と修正内容
- ✅ [日付] バグの説明と修正内容

### **既知の問題:**
- ⚠️ 問題の説明と回避方法（あれば）

---

## 🧪 テスト（将来的に）

\`\`\`javascript
// hooks/useFeatureActions.test.js
import { renderHook } from '@testing-library/react';
import { useFeatureActions } from './useFeatureActions';

describe('useFeatureActions', () => {
  it('適切にバリデーションを実行する', () => {
    const { result } = renderHook(() => useFeatureActions('test-id'));
    
    result.current.handleAction();
    
    expect(mockFunction).toHaveBeenCalled();
  });
});
\`\`\`

---

## 📝 変更履歴

### v1.1.0 (2025-XX-XX)
- ✅ 機能追加: XXXの実装
- ✅ バグ修正: XXXの修正
- ✅ リファクタリング: XXXの改善

### v1.0.0 (2025-XX-XX)
- ✅ 初期実装

---

## 🔗 関連ドキュメント

- [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) - プロジェクト全体のアーキテクチャ
- [requirements-specification.md](../../../docs/requirements-specification.md) - 要件定義
- [bugs.md](../../../docs/bugs.md) - バグ一覧
- 関連する他のドキュメント

---

## 🤖 AI利用時のヒント

この機能を修正・拡張する際は、AIに以下のように指示してください：

\`\`\`
docs/ARCHITECTURE.md の方針を守りつつ、
features/[feature-name]/components/MainComponent.jsx をリファクタしてください。
- UIとロジックの分離を維持
- 既存の hooks を活用
- constants.js の定数を使用
\`\`\`
```



---

## 保守方針と改善方向

1. **コード分割**  
   - UIロジック混在箇所を `hooks` へ移動し、再利用性を高める。
2. **重複排除**  
   - LiveKitやFirestoreの操作を共通化し、`utils`または`services`的役割でまとめる。
3. **パフォーマンス**  
   - 通話・タイマー・チャット同時稼働時は `React.memo`、`useCallback`、`useMemo` を適切に使用。
4. **バグ対応**  
   - バグ修正時は `docs/BUGS.md` の再発防止メモを参照。
   - AIに修正を依頼する際は、feature名と対象ファイルを明示する。

---

## AI利用ガイド（リファクタ時）

### **基本的な指示方法**
AIに指示する際の例：

```
@docs/ARCHITECTURE.md の方針を守りつつ、
@features/video-call/hooks/useVideoCall.js をリファクタしてください。
UIとロジックを分離し、副作用はhooksにまとめてください。
```

### **📝 リファクタリング完了後の必須タスク**

**重要:** 大規模なリファクタリング（10ファイル以上、フォルダ構成変更、アーキテクチャ変更）を完了した際は、**必ずリファクタリングレポートを作成**すること。

#### **レポートテンプレート**
`docs/templates/REFACTORING_REPORT.md`

#### **保存場所**
`docs/refactoring-reports/YYYY-MM-DD_feature-name_description.md`

#### **詳細ガイドライン**
[AI_GUIDELINES.md](./AI_GUIDELINES.md) を参照。

---

## 今後の検討項目
- TypeScript導入による型安全化（config・定数など）  
- 各 feature 内に `__tests__/` を追加して単体テスト運用を開始  
- Context API 分離または event-bus で依存性を低減  

---

## 更新履歴
- **2025-10-19:** リファクタリングレポート作成の義務化を追加（平林）
- **2025-10-19:** 構成を features/[feature-name]/ ベースに更新（平林）