/**
 * VideoCallRoomコンポーネント（リファクタリング版）
 * 
 * 責務を分離し、複数のカスタムフックとサブコンポーネントを使用して
 * 保守性と可読性を向上させたバージョンです。
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAudioManagement } from '../hooks/useAudioManagement.js';
import { useVideoManagement } from '../hooks/useVideoManagement.js';
import { useRoomConnection } from '../hooks/useRoomConnection.js';
import ParticipantCard from './ParticipantCard.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import { AUDIO_LEVEL, CONNECTION, ERROR_MESSAGES } from '../constants.js';

function VideoCallRoom({ roomId, userName, onRoomDisconnected, onLeaveRoom }) {
  // =============================================
  // State management
  // =============================================
  const [participants, setParticipants] = useState([]);
  const [localParticipant, setLocalParticipant] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // =============================================
  // Custom hooks
  // =============================================
  const {
    audioElementsRef,
    userInteractionEnabledRef,
    enableUserInteraction,
    playAudioSafely,
    cleanupAudioElement,
    resetAllAudioElements,
    attachAudioTrack
  } = useAudioManagement();

  const {
    localVideoRef,
    remoteVideoRefs,
    attachedTracksRef,
    attachVideoTrack,
    cleanupVideoElement,
    cleanupAllVideoElements,
    getVideoElement,
    hasVideoElement
  } = useVideoManagement();

  const {
    roomRef,
    hasConnectedRef,
    isConnectingRef,
    connectToRoomRef,
    updateParticipants,
    enableCameraAndMicrophone,
    setupRoomEventListeners,
    connectToRoom,
    disconnectFromRoom
  } = useRoomConnection();

  // =============================================
  // Audio level monitoring
  // =============================================
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startAudioLevelMonitoringRef = useRef(null);
  const startAudioLevelMonitoringWithTrackRef = useRef(null);
  const audioMonitoringRetryCountRef = useRef(0);

  /**
   * 音声レベル監視を開始する関数（トラック直接指定版）
   */
  const startAudioLevelMonitoringWithTrack = useCallback((audioTrack) => {
    if (!audioTrack || !audioTrack.mediaStreamTrack) {
      console.log('音声レベル監視: 有効なオーディオトラックが提供されていません');
      return;
    }

    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(
        new MediaStream([audioTrack.mediaStreamTrack])
      );
      source.connect(analyserRef.current);

      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const level = Math.min(100, (average / AUDIO_LEVEL.NORMALIZER) * 100);
        
        setAudioLevel(level);
        
        const isCurrentlySpeaking = level > AUDIO_LEVEL.SPEAKING_THRESHOLD;
        setIsSpeaking(isCurrentlySpeaking);

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      
      if (import.meta.env.DEV) {
        console.log('音声レベル監視開始（トラック指定）');
      }
    } catch (error) {
      console.error('音声レベル監視エラー:', error);
    }
  }, []);

  /**
   * 音声レベル監視を開始する関数
   */
  const startAudioLevelMonitoring = useCallback(() => {
    if (!localParticipant) {
      console.log('音声レベル監視: ローカル参加者が存在しません');
      return;
    }

    const audioTracks = Array.from(localParticipant.audioTracks.values());
    const audioTrack = audioTracks.find(track => track.source === 'microphone');
    
    if (audioTrack && audioTrack.mediaStreamTrack) {
      startAudioLevelMonitoringWithTrack(audioTrack);
    } else {
      console.log('音声レベル監視: マイクトラックが見つかりません - 再試行をスケジュール');
      
      if (audioMonitoringRetryCountRef.current < AUDIO_LEVEL.MAX_RETRY_COUNT) {
        audioMonitoringRetryCountRef.current++;
        setTimeout(() => {
          if (startAudioLevelMonitoringRef.current) {
            startAudioLevelMonitoringRef.current();
          }
        }, AUDIO_LEVEL.RETRY_DELAY);
      }
    }
  }, [localParticipant, startAudioLevelMonitoringWithTrack]);

  /**
   * 音声レベル監視を停止する関数
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    audioMonitoringRetryCountRef.current = 0;

    if (import.meta.env.DEV) {
      console.log('音声レベル監視停止');
    }
  }, []);

  // =============================================
  // Room connection management
  // =============================================
  const connectToRoomHandler = useCallback(async () => {
    try {
      await connectToRoom(
        roomId,
        userName,
        setParticipants,
        setLocalParticipant,
        setError,
        setIsConnecting,
        updateParticipants,
        enableCameraAndMicrophone,
        attachVideoTrack,
        attachAudioTrack,
        cleanupVideoElement,
        cleanupAudioElement
      );
    } catch (error) {
      console.error('接続処理エラー:', error);
      setError(ERROR_MESSAGES.CONNECTION_FAILED);
    }
  }, [
    roomId,
    userName,
    connectToRoom,
    updateParticipants,
    enableCameraAndMicrophone,
    attachVideoTrack,
    attachAudioTrack,
    cleanupVideoElement,
    cleanupAudioElement
  ]);

  // =============================================
  // Component lifecycle
  // =============================================
  useEffect(() => {
    roomIdRef.current = roomId;
    userNameRef.current = userName;
  }, [roomId, userName]);

  useEffect(() => {
    startAudioLevelMonitoringRef.current = startAudioLevelMonitoring;
    startAudioLevelMonitoringWithTrackRef.current = startAudioLevelMonitoringWithTrack;
  }, [startAudioLevelMonitoring, startAudioLevelMonitoringWithTrack]);

  useEffect(() => {
    connectToRoomRef.current = connectToRoomHandler;
  }, [connectToRoomHandler, connectToRoomRef]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('VideoCallRoom マウント - 接続開始', { roomId, userName });
    }
    
    // 既存の接続をクリーンアップ
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (error) {
        console.warn('既存接続のクリーンアップエラー:', error);
      }
      roomRef.current = null;
    }
    
    // 状態をリセット
    hasConnectedRef.current = false;
    isConnectingRef.current = false;
    setError(null);
    
    // 既存の音声要素をリセット
    resetAllAudioElements(audioContextRef, analyserRef);
    
    // ユーザーインタラクションを有効化
    enableUserInteraction();
    
    // 接続を開始
    const initializeConnection = async () => {
      try {
        if (connectToRoomRef.current) {
          await connectToRoomRef.current();
        }
      } catch (error) {
        console.error('初期接続エラー:', error);
      }
    };
    
    setTimeout(initializeConnection, 100);

    return () => {
      if (import.meta.env.DEV) {
        console.log('VideoCallRoom アンマウント - 接続切断');
      }
      
      // 音声レベル監視を停止
      stopAudioLevelMonitoring();
      
      // ルームから切断
      if (roomRef.current) {
        disconnectFromRoom(
          cleanupAudioElement,
          cleanupAllVideoElements,
          onLeaveRoom,
          onRoomDisconnected
        );
        roomRef.current = null;
      }
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
    };
  }, [enableUserInteraction, resetAllAudioElements, stopAudioLevelMonitoring]);

  // =============================================
  // Render
  // =============================================
  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* 接続状態表示 */}
      <ConnectionStatus
        isConnecting={isConnecting}
        error={error}
        participants={participants}
        localParticipant={localParticipant}
      />

      {/* 参加者一覧 */}
      {participants && participants.length > 0 && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {participants.map((participant) => {
              const isLocal = participant.isLocal;
              return (
                <ParticipantCard
                  key={participant.identity}
                  participant={participant}
                  isLocal={isLocal}
                  localVideoRef={localVideoRef}
                  remoteVideoRefs={remoteVideoRefs}
                  audioLevel={audioLevel}
                  isSpeaking={isSpeaking}
                  isVideoEnabled={isVideoEnabled}
                  isAudioEnabled={isAudioEnabled}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(VideoCallRoomRefactored, (prevProps, nextProps) => {
  return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.userName === nextProps.userName
  );
});
