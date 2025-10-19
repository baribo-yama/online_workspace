// src/features/study-room/index.js
//
// study-room機能のエクスポート（レベル2: チーム開発対応構成）
// 他の機能から簡単にimportできるようにする

// ===== Components =====
// Home
export { HomePage } from './components/home';
export { RoomCreationForm, RoomList, RoomCard } from './components/home';

// Room
export { RoomPage } from './components/room';
export { RoomHeader, RoomSidebar, RoomMainContent, HostControls } from './components/room';

// Game
export { GameOverlay } from './components/game';

// Shared
export { LoadingScreen, UserNameInput } from './components/shared';

// ===== Hooks =====
// Room hooks
export { useRoomData, useRoomActions, useRoomPermissions } from './hooks/room';

// Home hooks
export { useRoomsList, useRoomCreation, useParticipantsData } from './hooks/home';

// Shared hooks
export { useUserName } from './hooks/shared';

// ===== Utils =====
export * from './utils';

// ===== Constants =====
export * from './constants';
