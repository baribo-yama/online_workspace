/**
 * Slackメッセージ生成ユーティリティ
 * 
 * 【設計原則】
 * - 純粋関数（副作用なし）→ ユニットテストが容易
 * - プラットフォーム固有のフォーマット知識をカプセル化
 * - 将来的なカスタマイズ対応（絵文字、レイアウト等）
 */

/**
 * 部屋作成メッセージを生成
 * @param {Object} data - 部屋データ
 * @param {string} data.hostName - ホスト名
 * @param {string} data.roomTitle - 部屋タイトル
 * @param {string} data.roomUrl - 部屋URL
 * @returns {string} Slackメッセージテキスト
 */
export const buildRoomCreatedMessage = ({ hostName, roomTitle, roomUrl }) => {
  return [
    `${hostName}さんが部屋を作成しました！`,
    `📚 部屋名: ${roomTitle}`,
    `🔗 参加する: ${roomUrl}`
  ].join('\n');
};

/**
 * 参加者追加メッセージを生成
 * @param {Object} data - 参加データ
 * @param {string} data.userName - 参加者名
 * @param {number} data.participantCount - 現在の参加者数
 * @returns {string} Slackメッセージテキスト
 */
export const buildParticipantJoinedMessage = ({ userName, participantCount }) => {
  return [
    `${userName}さんが参加しました！`,
    `👥 現在の参加者: ${participantCount}名`
  ].join('\n');
};

/**
 * 部屋終了メッセージを生成
 * @returns {string} Slackメッセージテキスト
 */
export const buildRoomEndedMessage = () => {
  return 'この部屋は終了しました 🏁';
};
