/**
 * useRoomPermissions - ルーム権限の計算
 *
 * 責務:
 * - ホスト権限のチェック
 * - ゲーム開始可否の判定
 * - ゲームステータスの取得
 *
 * RoomPage から抽出した権限計算ロジック
 *
 * @param {Object} room - ルームデータ
 * @param {string} myParticipantId - 自分の参加者ID
 * @returns {Object} { isHost, canStartGame, gameStatus }
 */
import { useMemo } from "react";
import { GAME_STATUS } from "../../constants";

export const useRoomPermissions = (room, myParticipantId) => {
  // ホスト権限チェック
  const isHost = useMemo(() => {
    return Boolean(room?.hostId && room.hostId === myParticipantId);
  }, [room?.hostId, myParticipantId]);

  // ゲーム開始可否の判定
  const canStartGame = useMemo(() => {
    return isHost && room?.timer?.mode === 'break';
  }, [isHost, room?.timer?.mode]);

  // ゲームステータスの取得
  const gameStatus = useMemo(() => {
    return room?.game?.status || GAME_STATUS.IDLE;
  }, [room?.game?.status]);

  return {
    isHost,
    canStartGame,
    gameStatus,
  };
};

