import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { HOST_INACTIVITY_CONFIG } from "../../constants";

const { ROOM_CHECK_INTERVAL_MS, CONFIRMATION_TOAST_DURATION_MS } = HOST_INACTIVITY_CONFIG;
const COUNTDOWN_INTERVAL_MS = 1000;

export const useHostInactivity = (roomId, isHost, room, onRoomEnd) => {
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const countdownIntervalRef = useRef(null);
  const notificationTimerRef = useRef(null);

  const handleAutoEnd = useCallback(async () => {
    try {
      console.log("[useHostInactivity] ルーム自動終了処理開始");
      setShowToast(false);
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      if (onRoomEnd) {
        await onRoomEnd(true); // skipConfirm = true を渡す
      }

      navigate("/");
    } catch (error) {
      console.error("[useHostInactivity] 自動終了エラー:", error);
    }
  }, [navigate, onRoomEnd]);

  useEffect(() => {
    if (countdown === 0 && showToast) {
      console.log("[useHostInactivity] カウントダウン終了 - ルーム自動終了");
      handleAutoEnd();
    }
  }, [countdown, showToast, handleAutoEnd]);

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setCountdown(Math.floor(CONFIRMATION_TOAST_DURATION_MS / 1000));

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (showToast) {
      startCountdown();
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
    }
  }, [showToast, startCountdown]);

  const scheduleNextNotification = useCallback(() => {
    if (!room?.createdAt) {
      return;
    }

    try {
      const createdAtMs = room.createdAt.toMillis ? room.createdAt.toMillis() : room.createdAt;
      const nowMs = Date.now();
      const elapsedMs = nowMs - createdAtMs;
      const nextNotificationMs = ROOM_CHECK_INTERVAL_MS - (elapsedMs % ROOM_CHECK_INTERVAL_MS);
      
      console.log(`[useHostInactivity] 次の通知まで: ${Math.floor(nextNotificationMs / 1000)}秒`);

      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }

      notificationTimerRef.current = setTimeout(() => {
        console.log("[useHostInactivity] 2時間経過 - 通知表示");
        setShowToast(true);
        scheduleNextNotification();
      }, nextNotificationMs);

    } catch (error) {
      console.error("[useHostInactivity] 通知予約エラー:", error);
    }
  }, [room?.createdAt]);

  const handleConfirm = useCallback(() => {
    try {
      console.log("[useHostInactivity] ユーザー応答 - トースト非表示");
      setShowToast(false);
      setCountdown(null);
    } catch (error) {
      console.error("[useHostInactivity] 応答処理エラー:", error);
    }
  }, []);

  useEffect(() => {
    if (!isHost || !room?.createdAt) {
      return;
    }

    console.log("[useHostInactivity] 通知監視開始");
    scheduleNextNotification();

    return () => {
      console.log("[useHostInactivity] 通知監視停止");
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isHost, room?.createdAt, scheduleNextNotification]);

  return {
    showToast,
    countdown,
    handleConfirm
  };
};