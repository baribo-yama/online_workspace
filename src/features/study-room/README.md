# Study Room Feature（勉強部屋機能）

## 📝 概要
オンライン自習室アプリケーションのコア機能。部屋の作成・参加、ポモドーロタイマー、ビデオ通話、ゲーム機能を統合し、集中できる学習環境を提供します。

**主要機能:**
- 部屋の作成・一覧表示・参加
- ポモドーロタイマー（共有・個人）
- ビデオ通話（LiveKit統合）
- 休憩時間のミニゲーム
- ホスト権限管理

---

## 📁 ディレクトリ構造（レベル2: チーム開発対応）

```
src/features/study-room/
│
├── components/
│   ├── home/                           # ホームページ機能
│   │   ├── HomePage.jsx                #   統合コンポーネント - 90行
│   │   ├── RoomCreationForm.jsx       #   部屋作成フォーム - 60行
│   │   ├── RoomList.jsx               #   部屋一覧表示 - 50行
│   │   ├── RoomCard.jsx               #   個別カード - 45行
│   │   └── index.js                   #   エクスポート
│   │
│   ├── room/                           # ルームページ機能
│   │   ├── RoomPage.jsx               #   統合コンポーネント - 110行
│   │   ├── RoomHeader.jsx             #   ヘッダー - 60行
│   │   ├── RoomSidebar.jsx            #   左サイドバー - 55行
│   │   ├── RoomMainContent.jsx        #   右コンテンツ - 50行
│   │   ├── HostControls.jsx           #   ホスト専用UI - 50行
│   │   └── index.js                   #   エクスポート
│   │
│   ├── game/                           # ゲーム機能
│   │   ├── GameOverlay.jsx            #   オーバーレイ - 70行
│   │   └── index.js
│   │
│   └── shared/                         # 共通UIコンポーネント
│       ├── LoadingScreen.jsx          #   ローディング表示 - 20行
│       ├── UserNameInput.jsx          #   名前入力欄 - 25行
│       └── index.js
│
├── hooks/
│   ├── room/                           # ルーム関連フック
│   │   ├── useRoomData.js             #   データ取得 - 60行
│   │   ├── useRoomActions.js          #   操作ロジック - 75行
│   │   ├── useRoomPermissions.js      #   権限計算 - 35行
│   │   └── index.js
│   │
│   ├── home/                           # ホーム関連フック
│   │   ├── useRoomsList.js            #   部屋一覧取得 - 45行
│   │   ├── useRoomCreation.js         #   部屋作成 - 60行
│   │   ├── useParticipantsData.js     #   参加者情報 - 70行
│   │   └── index.js
│   │
│   └── shared/                         # 共通フック
│       ├── useUserName.js             #   名前管理 - 35行
│       └── index.js
│
├── utils/                              # ユーティリティ関数（純粋関数）
│   ├── roomValidation.js              #   バリデーション - 60行
│   ├── localStorage.js                #   localStorage操作 - 30行
│   └── index.js
│
├── constants/                          # 定数（カテゴリ別）
│   ├── limits.js                      #   制限値 - 15行
│   ├── errors.js                      #   エラーメッセージ - 20行
│   ├── messages.js                    #   その他メッセージ - 15行
│   ├── defaults.js                    #   デフォルト値 - 15行
│   └── index.js                       #   統合エクスポート
│
├── index.js                            # 外部公開API
├── README.md                           # このファイル
└── DEPENDENCIES.md                     # 依存関係ドキュメント
```

**合計: 35ファイル / 約1,200行**  
**平均ファイル行数: 約35行**

---

## 🎯 責務の分離

### **📄 components/** - UIレイヤー

#### home/ - ホームページ機能
- **HomePage.jsx**: レイアウト統合のみ。ロジックは全てhooks経由
- **RoomCreationForm.jsx**: 作成フォームUI。バリデーションはhooks側
- **RoomList.jsx**: 一覧表示とローディング・空状態の管理
- **RoomCard.jsx**: 個別の部屋カード表示

#### room/ - ルームページ機能
- **RoomPage.jsx**: レイアウト統合のみ。権限チェックもhooks経由
- **RoomHeader.jsx**: ヘッダーUI。ボタンの表示制御
- **RoomSidebar.jsx**: 参加者リスト + ビデオ通話エリア
- **RoomMainContent.jsx**: タイマー + ホストコントロールエリア
- **HostControls.jsx**: ホスト専用のゲーム開始ボタンなど

#### game/ - ゲーム機能
- **GameOverlay.jsx**: ゲーム画面の全画面オーバーレイ

#### shared/ - 共通コンポーネント
- **LoadingScreen.jsx**: ローディング画面（再利用可能）
- **UserNameInput.jsx**: 名前入力フィールド（再利用可能）

---

### **🔧 hooks/** - ロジックレイヤー

#### room/ - ルーム関連
- **useRoomData.js**: Firestoreからのリアルタイムデータ取得
- **useRoomActions.js**: 退出・終了処理、エラーハンドリング
- **useRoomPermissions.js**: ホスト権限、ゲーム開始可否の計算

#### home/ - ホーム関連
- **useRoomsList.js**: 部屋一覧のリアルタイム取得
- **useRoomCreation.js**: 部屋作成ロジック、バリデーション
- **useParticipantsData.js**: 各部屋の参加者情報取得

#### shared/ - 共通
- **useUserName.js**: ユーザー名のlocalStorage管理

---

### **🛠️ utils/** - ユーティリティ（純粋関数）

- **roomValidation.js**: バリデーション関数（副作用なし）
- **localStorage.js**: localStorage操作の一元管理

---

### **📊 constants/** - 定数（カテゴリ別）

- **limits.js**: 制限値（MAX_PARTICIPANTS, MAX_ACTIVE_ROOMS など）
- **errors.js**: エラーメッセージ
- **messages.js**: 確認・ローディングメッセージ
- **defaults.js**: デフォルト値、ゲームステータス

---

## 🔄 データフロー

### **ホームページのフロー**

```
┌──────────────┐
│   Firestore  │
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌────────────────┐
│useRoomsList │   │useParticipants │
│  (部屋一覧) │   │   Data         │
└──────┬──────┘   └────────┬───────┘
       │                   │
       └─────────┬─────────┘
                 ▼
         ┌───────────────┐
         │   HomePage    │ ← 統合のみ
         └───────┬───────┘
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
 RoomList   RoomCard   RoomCreation
                          Form
                          ↓
                   useRoomCreation
```

### **ルームページのフロー**

```
┌──────────────┐
│   Firestore  │
└──────┬───────┘
       │
       ├──────────────────┬──────────────┐
       │                  │              │
       ▼                  ▼              ▼
┌─────────────┐   ┌──────────────┐   ┌─────────┐
│useRoomData  │   │useParticipants│  │useRoom  │
│  (部屋情報) │   │  (参加者情報) │  │Actions  │
└──────┬──────┘   └──────┬───────┘   └────┬────┘
       │                 │                 │
       └────────┬────────┘                 │
                │                          │
                ▼                          │
        ┌───────────────┐                  │
        │useRoomPermiss-│                  │
        │ions (権限計算)│                  │
        └───────┬───────┘                  │
                │                          │
                ▼                          │
         ┌──────────────┐                  │
         │   RoomPage   │ ← 統合のみ      │
         └──────┬───────┘                  │
                │                          │
      ┌─────────┼──────────┐               │
      ▼         ▼          ▼               │
RoomSidebar RoomMain   GameOverlay         │
            Content                        │
              ↓                            │
       HostControls ───────────────────────┘
         (操作トリガー)
```

---

## 💡 使用方法

### **基本的な使い方**

```javascript
// 他の機能からインポート
import { HomePage, RoomPage } from '@/features/study-room';

// Routerで使用
<Route path="/" element={<HomePage />} />
<Route path="/room/:roomId" element={<RoomPage />} />
```

### **hooks を再利用する場合**

```javascript
import { useRoomData, useRoomActions, useUserName } from '@/features/study-room';

function CustomComponent() {
  const { room, loading } = useRoomData(roomId);
  const { handleLeaveRoom } = useRoomActions(roomId, leaveRoom, isHost);
  const { name, handleNameChange } = useUserName();

  // 独自のUIで同じロジックを使用できる
  return <div>{room.title}</div>;
}
```

### **定数を使用する場合**

```javascript
import { ROOM_LIMITS, ROOM_ERRORS } from '@/features/study-room';

if (count > ROOM_LIMITS.MAX_PARTICIPANTS) {
  alert(ROOM_ERRORS.ROOM_FULL);
}
```

---

## ⚠️ 注意点・制約事項

### **重要な制約:**
- 同時に存在できる部屋数は最大3部屋（MVP制限）
- 1部屋の最大参加者数は5人
- ホスト権限は部屋作成者に固定（移譲なし）
- ホストが退出しても部屋は残る

### **hooksの依存関係:**
- `useRoomActions` は `isHost` を引数で受け取る
- `useRoomPermissions` は `room` と `myParticipantId` が必要
- `useParticipantsData` は `rooms` 配列が必要

### **パフォーマンス上の注意:**
- 大きなコンポーネント（HomePage, RoomPage）は遅延読み込み
- hooks内で `useCallback`, `useMemo` を適切に使用
- リアルタイム更新により頻繁な再レンダリングが発生

---

## 🚀 今後の拡張方針

### **短期的な改善案:**
- [ ] チャット機能の追加（components/chat/）
- [ ] 統計機能の追加（components/stats/）
- [ ] エラーバウンダリの実装

### **長期的な展望:**
- [ ] TypeScript化（types/ フォルダ活用）
- [ ] 単体テストの追加（__tests__/ フォルダ）
- [ ] アクセシビリティ対応の強化

### **拡張例: チャット機能を追加する場合**

```javascript
// components/room/RoomPage.jsx
import { ChatPanel } from '@/features/chat';

export function RoomPage() {
  return (
    <div className="flex h-screen">
      <RoomSidebar {...} />
      <RoomMainContent {...} />
      
      {/* 🆕 チャット追加（既存コードに影響なし） */}
      <ChatPanel roomId={roomId} userId={myParticipantId} />
    </div>
  );
}
```

---

## 🐛 既知の問題・バグ修正履歴

### **修正済み:**
- ✅ [2025-10-17] ホスト以外が部屋を削除できるバグ → `useRoomActions` に権限チェック追加
- ✅ [2025-10-17] マジックナンバー・マジックストリング → `constants/` で一元管理
- ✅ [2025-10-19] コンポーネントの肥大化 → レベル2構成にリファクタリング

### **既知の問題:**
- なし（現在は安定動作中）

---

## 📝 変更履歴

### v2.0.0 (2025-10-19)
- ✅ **レベル2構成にリファクタリング**
  - hooks をカテゴリ別に分離（room, home, shared）
  - components を機能別に分割（home, room, game, shared）
  - constants をカテゴリ別に分割（limits, errors, messages, defaults）
  - utils フォルダを追加（roomValidation, localStorage）
  - 268行のHomePage → 90行に削減
  - 238行のRoomPage → 110行に削減
  - 平均ファイル行数: 約35行
  - チーム開発での並行作業が容易に

### v1.3.2 (2025-10-17)
- ✅ パフォーマンス最適化（useCallback, useMemo活用）

### v1.3.0 (2025-10-17)
- ✅ ホスト権限の固定化（自動移譲を削除）

### v1.2.0 (2025-10-17)
- ✅ マジックナンバー・マジックストリングの完全排除

### v1.0.0 (2025-01-XX)
- ✅ 初期実装（レベル1構成）

---

## 🔗 関連ドキュメント

- [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) - プロジェクト全体のアーキテクチャ
- [CODING_RULES.md](../../../docs/CODING_RULES.md) - コーディング規約
- [requirements-specification.md](../../../docs/requirements-specification.md) - 要件定義
- [DEPENDENCIES.md](./DEPENDENCIES.md) - 依存関係の詳細

---

## 🤖 AI利用時のヒント

この機能を修正・拡張する際は、AIに以下のように指示してください：

```
@docs/ARCHITECTURE.md の方針を守りつつ、
@src/features/study-room/components/home/RoomCard.jsx をリファクタしてください。
- UIとロジックの分離を維持
- 既存の hooks を活用
- constants/ の定数を使用
```

### **機能追加時の指示例:**

```
study-room 機能に新しいコンポーネント SearchBar を追加してください。
- components/home/ に配置
- useRoomsList から検索ロジックを分離
- 50行以内で実装
```

---

## 📊 チーム開発での役割分担例

### **担当者A: ホームページ機能**
- `components/home/`
- `hooks/home/`

### **担当者B: ルームページ機能**
- `components/room/`
- `hooks/room/`

### **担当者C: 共通機能・インフラ**
- `components/shared/`
- `hooks/shared/`
- `utils/`
- `constants/`

このように分担すれば、ファイルの競合を最小限に抑えられます。
