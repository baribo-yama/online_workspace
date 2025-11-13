/**
 * VideoCallRoom - LiveKit リアルタイムビデオ通話コンポーネント
 *
 * Features:
 * - Real-time video/audio communication
 * - Camera/microphone controls
 * - Audio level monitoring with speaking indicator
 * - Dynamic participant management
 * - Auto-reconnection handling
 *
 * @param {string} roomId - Room identifier
 * @param {string} userName - User display name
 * @param {function} onRoomDisconnected - Room disconnection callback
 * @param {function} onLeaveRoom - Room leave callback
 */
import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
} from "livekit-client";
import { Video, VideoOff, Mic, MicOff, Phone, Users } from "lucide-react";
import {
  LIVEKIT_CONFIG,
  generateRoomName,
  generateParticipantName,
  generateAccessToken,
} from "../config/livekit";
import { TIMINGS, AUDIO } from "../constants";
import { stopAllLocalTracks } from "../utils/streamUtils";

// =============================================
// Configuration constants
// =============================================
/**
 * 遅延系の定数は ../constants.js (TIMINGS) に集約。
 *
 * 意図:
 * - TRACK_ATTACHMENT_DELAY: 体感応答性向上のため 200ms → 50ms。
 * - LOCAL_TRACK_ATTACHMENT_DELAY: 計測で問題無しのため 100ms → 20ms。
 * - RETRY_ATTACHMENT_DELAY: 復帰を早めるため 500ms → 100ms。
 *
 * もし競合やチラつきが生じる場合は 25ms 程度ずつ増やして調整。
 */
const TRACK_ATTACHMENT_DELAY = TIMINGS.TRACK_ATTACHMENT_DELAY;
const LOCAL_TRACK_ATTACHMENT_DELAY = TIMINGS.LOCAL_TRACK_ATTACHMENT_DELAY;
const RETRY_ATTACHMENT_DELAY = TIMINGS.RETRY_ATTACHMENT_DELAY;
const AUDIO_LEVEL_NORMALIZER = 128; // 音声レベル正規化用の除数
const SPEAKING_THRESHOLD = 3; // 話していると判定する音声レベル閾値

// マイク音声レベル監視のリトライロジック設定
const AUDIO_LEVEL_MONITORING_RETRY_CONFIG = {
  INITIAL_DELAY_MS: 500, // 初回の音声トラック検索遅延
  FALLBACK_RETRY_DELAY_MS: 1000, // フォールバック再試行時の遅延
};

function VideoCallRoom({ roomId, userName, onRoomDisconnected, onLeaveRoom }) {
  // =============================================
  // State management
  // =============================================
  const [participants, setParticipants] = useState([]); // 参加者リスト
  const [localParticipant, setLocalParticipant] = useState(null); // ローカル参加者
  const [isConnecting, setIsConnecting] = useState(false); // 接続中フラグ
  const [error, setError] = useState(null); // エラー状態
  const [isVideoEnabled, setIsVideoEnabled] = useState(false); // ビデオ有効状態（デフォルトOFF）
  const [isAudioEnabled, setIsAudioEnabled] = useState(false); // オーディオ有効状態（デフォルトOFF）
  const [audioLevel, setAudioLevel] = useState(0); // 音声レベル
  const [isSpeaking, setIsSpeaking] = useState(false); // 話している状態

  // =============================================
  // Refs for DOM elements and function references
  // =============================================
  const roomRef = useRef(null); // LiveKitルームインスタンス
  const hasConnectedRef = useRef(false); // 接続済みフラグ
  const isConnectingRef = useRef(false); // 接続中フラグ
  const attachVideoTrackRef = useRef(null); // ビデオトラックアタッチ関数の参照
  const connectToRoomRef = useRef(null); // 接続関数の参照
  const audioContextRef = useRef(null); // Web Audio APIのAudioContext
  const analyserRef = useRef(null); // 音声レベル分析用のAnalyserNode
  const animationFrameRef = useRef(null); // 音声レベル監視用のアニメーションフレーム
  const startAudioLevelMonitoringRef = useRef(null); // 音声レベル監視開始関数の参照
  const startAudioLevelMonitoringWithTrackRef = useRef(null); // トラック指定音声レベル監視開始関数の参照
  const audioMonitoringRetryCountRef = useRef(0); // 音声レベル監視の再試行回数
  const roomIdRef = useRef(roomId); // ルームIDの参照
  const userNameRef = useRef(userName); // ユーザー名の参照
  const audioElementsRef = useRef(new Map()); // 音声要素の管理用Map
  const userInteractionEnabledRef = useRef(false); // ユーザーインタラクション有効フラグ

  /**
   * ユーザーインタラクションを有効化する関数
   *
   * ブラウザの自動再生制限を回避するため、
   * 無音の音声を再生してユーザーインタラクションを記録します。
   */
  const enableUserInteraction = useCallback(() => {
    if (userInteractionEnabledRef.current) {
      return; // 既に有効化済み
    }

    try {
      // 無音の音声データ（Base64エンコード）
      const silentAudioData =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      const silentAudio = new Audio(silentAudioData);
      silentAudio.volume = AUDIO.SILENT_AUDIO_VOLUME; // 音量を最小に設定（定数化）

      // 無音音声を再生してユーザーインタラクションを記録
      silentAudio
        .play()
        .then(() => {
          userInteractionEnabledRef.current = true;
          if (import.meta.env.DEV) {
            console.log("ユーザーインタラクション有効化完了");
          }
          // 音声レベル監視を開始
          setTimeout(() => {
            if (startAudioLevelMonitoringRef.current) {
              startAudioLevelMonitoringRef.current();
            }
          }, 100);
        })
        .catch((error) => {
          if (import.meta.env.DEV) {
            console.log("無音音声再生失敗（通常は問題なし）:", error);
          }
          // 再生に失敗してもユーザーインタラクションを有効化
          userInteractionEnabledRef.current = true;
          setTimeout(() => {
            if (startAudioLevelMonitoringRef.current) {
              startAudioLevelMonitoringRef.current();
            }
          }, 100);
        });

      // 音声要素を即座に停止
      setTimeout(() => {
        silentAudio.pause();
        silentAudio.src = "";
      }, 100);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("ユーザーインタラクション有効化エラー:", error);
      }
      // エラーが発生してもユーザーインタラクションを有効化
      userInteractionEnabledRef.current = true;
      setTimeout(() => {
        if (startAudioLevelMonitoringRef.current) {
          startAudioLevelMonitoringRef.current();
        }
      }, 100);
    }
  }, []);

  /**
   * 音声レベル監視を開始する関数
   *
   * AudioContextとAnalyserNodeを使用して音声レベルを監視し、
   * 話している状態を判定します。
   */
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioContextRef.current && analyserRef.current) {
      return; // 既に監視中
    }

    // ユーザーインタラクションが有効でない場合は待機
    if (!userInteractionEnabledRef.current) {
      console.log("ユーザーインタラクション待機中...");
      return;
    }

    try {
      // AudioContextを初期化（ユーザーインタラクション後に実行）
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      // AudioContextが停止状態の場合は再開
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch((error) => {
          console.warn("AudioContext再開エラー:", error);
        });
      }

      // AnalyserNodeを作成
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      // 音声レベル監視のアニメーションフレーム
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // 音声レベルを計算
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedLevel = Math.min(average / AUDIO_LEVEL_NORMALIZER, 1);

        setAudioLevel(normalizedLevel);

        // 話している状態を判定
        const isCurrentlySpeaking = normalizedLevel > SPEAKING_THRESHOLD / 100;
        if (isCurrentlySpeaking !== isSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      console.log("音声レベル監視を開始しました");
    } catch (error) {
      console.warn("音声レベル監視開始エラー:", error);
    }
  }, [isSpeaking]);

  /**
   * 音声レベル監視を停止する関数
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    console.log("音声レベル監視を停止しました");
  }, []);

  /**
   * トラックを指定して音声レベル監視を開始する関数
   *
   * ローカルオーディオトラックをAudioContextに接続して
   * 音声レベル監視を開始します。
   */
  const startAudioLevelMonitoringWithTrack = useCallback(
    (track) => {
      if (!track || !track.mediaStreamTrack) {
        console.warn("音声トラックが無効です");
        return;
      }

      // ユーザーインタラクションが有効でない場合は待機
      if (!userInteractionEnabledRef.current) {
        console.log("ユーザーインタラクション待機中...");
        return;
      }

      try {
        // AudioContextを初期化
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        // AudioContextが停止状態の場合は再開
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume().catch((error) => {
            console.warn("AudioContext再開エラー:", error);
          });
        }

        // AnalyserNodeを作成
        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        // 音声トラックをAudioContextに接続
        const source = audioContextRef.current.createMediaStreamSource(
          new MediaStream([track.mediaStreamTrack])
        );
        source.connect(analyserRef.current);

        // 音声レベル監視のアニメーションフレーム
        const monitorAudioLevel = () => {
          if (!analyserRef.current) return;

          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);

          // 音声レベルを計算
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const normalizedLevel = Math.min(average / AUDIO_LEVEL_NORMALIZER, 1);

          setAudioLevel(normalizedLevel);

          // 話している状態を判定
          const isCurrentlySpeaking =
            normalizedLevel > SPEAKING_THRESHOLD / 100;
          if (isCurrentlySpeaking !== isSpeaking) {
            setIsSpeaking(isCurrentlySpeaking);
          }

          animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
        };

        monitorAudioLevel();
        console.log("トラック指定音声レベル監視を開始しました");
      } catch (error) {
        console.warn("トラック指定音声レベル監視開始エラー:", error);
      }
    },
    [isSpeaking]
  );

  // refに関数を設定
  startAudioLevelMonitoringRef.current = startAudioLevelMonitoring;
  startAudioLevelMonitoringWithTrackRef.current =
    startAudioLevelMonitoringWithTrack;

  // ビデオ表示管理用のref
  const localVideoRef = useRef(null); // ローカルビデオ要素の参照
  const remoteVideoRefs = useRef(new Map()); // リモートビデオ要素の管理用Map
  const videoLogCountRef = useRef(0); // ビデオログ出力回数の制限用
  const attachedTracksRef = useRef(new Set()); // アタッチ済みトラックを追跡

  /**
   * 参加者リストを更新する関数
   *
   * ローカル参加者とリモート参加者を統合して状態を更新します。
   * 参加者の追加・削除・変更を検知して、効率的に状態を更新します。
   *
   * @function updateParticipants
   */
  const updateParticipants = useCallback(() => {
    if (!roomRef.current) return;

    const allParticipants = [
      roomRef.current.localParticipant,
      ...Array.from(roomRef.current.remoteParticipants.values()),
    ].filter((p) => p);

    setParticipants([...allParticipants]);

    setLocalParticipant(roomRef.current.localParticipant);
  }, []);

  /**
   * 音声トラックをHTML音声要素にアタッチする関数
   *
   * LiveKitから受信したリモート参加者の音声トラックを
   * HTMLのaudio要素に接続し、自動的に再生を開始します。
   * 重複作成を防ぐため、参加者ごとに既存要素をチェックします。
   *
   * @param {Track} track - LiveKitの音声トラック
   * @param {RemoteParticipant} participant - 音声を送信している参加者
   */
  const attachAudioTrack = useCallback(
    (track, participant) => {
      if (!track || !participant) {
        console.warn("音声トラックまたは参加者が無効です");
        return;
      }

      try {
        // 既存の音声要素をチェック（重複作成を防ぐ）
        const existingElement = audioElementsRef.current.get(
          participant.identity
        );
        if (existingElement) {
          // 既存の要素の音声ストリームを更新
          /**
           * ベストプラクティス:
           * リモート MediaStreamTrack に対して track.stop() を呼ばないこと。
           * track.stop() はローカルトラック専用で、リモートトラックに対して呼ぶと
           * 他参加者のメディアにも影響を与える可能性があるため、
           * srcObject の解放と DOM 要素の削除のみを行うこと。
           */
          existingElement.srcObject = new MediaStream([track.mediaStreamTrack]);
          // 要素を再表示（一時無効化されていた場合）
          existingElement.style.display = "none"; // 非表示のまま
          if (import.meta.env.DEV) {
            console.log("既存の音声要素を更新:", participant.identity);
          }
          return;
        }

        // 新しいHTML音声要素を作成
        const audioElement = document.createElement("audio");
        audioElement.autoplay = true; // 自動再生を有効化
        audioElement.playsInline = true; // インライン再生（モバイル対応）
        audioElement.muted = false; // ミュートを解除
        audioElement.volume = 1.0; // 音量を最大に設定

        // 音声ストリームを設定（MediaStreamの場合はpreloadとcrossOriginは効果なし）
        audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);

        // 音声要素をDOMに追加（非表示で管理）
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);

        // 参加者IDをキーとして音声要素の参照を保存
        audioElementsRef.current.set(participant.identity, audioElement);

        // 音声の再生を開始
        const playAudioSafely = async () => {
          try {
            await audioElement.play();
            if (import.meta.env.DEV) {
              console.log("音声再生成功:", participant.identity);
            }
          } catch (error) {
            console.warn("音声再生エラー:", error);

            // ブラウザの自動再生制限への対応
            if (error.name === "NotAllowedError") {
              console.log("音声再生にはユーザーインタラクションが必要です");

              // ユーザーインタラクションを有効化
              enableUserInteraction();

              // 複数のタイミングで再試行（定数化）
              const retryTimes = TIMINGS.AUDIO_PLAY_RETRY_MS;
              let retryIndex = 0;

              const retryPlay = () => {
                if (retryIndex < retryTimes.length) {
                  setTimeout(() => {
                    audioElement.play().catch((e) => {
                      console.warn(`音声再生再試行 ${retryIndex + 1} 失敗:`, e);
                      retryIndex++;
                      retryPlay();
                    });
                  }, retryTimes[retryIndex]);
                }
              };

              // ユーザーインタラクションイベントを監視
              const handleUserInteraction = () => {
                audioElement
                  .play()
                  .catch((e) =>
                    console.warn("ユーザーインタラクション後の音声再生失敗:", e)
                  );
              };

              // 複数のイベントを監視
              document.addEventListener("click", handleUserInteraction, {
                once: true,
              });
              document.addEventListener("touchstart", handleUserInteraction, {
                once: true,
              });
              document.addEventListener("keydown", handleUserInteraction, {
                once: true,
              });
              document.addEventListener("mousemove", handleUserInteraction, {
                once: true,
              });

              // バックグラウンドで再試行
              retryPlay();
            }
          }
        };

        playAudioSafely();

        if (import.meta.env.DEV) {
          console.log("音声トラックをアタッチ:", participant.identity, {
            hasMediaStreamTrack: !!track.mediaStreamTrack,
            audioElementCreated: !!audioElement,
            autoplay: audioElement.autoplay,
            muted: audioElement.muted,
            volume: audioElement.volume,
          });
        }
      } catch (error) {
        console.error("音声トラックアタッチエラー:", error);
      }
    },
    [enableUserInteraction]
  );

  /**
   * 指定された参加者の音声要素をクリーンアップする関数
   *
   * 参加者が退出した際や、音声トラックが非購読された際に
   * 音声要素を一時的に無効化してメモリリークを防ぎます。
   * DOMからは削除せず、要素を保持してリロード時の音声問題を回避します。
   * @param {string} participantIdentity - 参加者のID
   */
  const cleanupAudioElement = useCallback((participantIdentity) => {
    const audioElement = audioElementsRef.current.get(participantIdentity);
    if (audioElement) {
      // 音声の再生を停止
      audioElement.pause();
      // 音声ストリームをクリア（リモートトラックは停止しない）
      audioElement.srcObject = null;
      // DOMからは削除せず、非表示にする（要素を保持）
      audioElement.style.display = "none";
      // 参照マップからは削除しない（要素を保持）
      // audioElementsRef.current.delete(participantIdentity);

      if (import.meta.env.DEV) {
        console.log("音声要素を一時無効化:", participantIdentity);
      }
    }
  }, []);

  /**
   * カメラとマイクを有効化する関数
   * ローカル参加者のカメラとマイクを有効化し、
   * メディアアクセスエラーの適切な処理を行います。
   */
  const enableCameraAndMicrophone = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      try {
        await roomRef.current.localParticipant.setCameraEnabled(true);
      } catch (cameraError) {
        console.warn("カメラ有効化エラー:", cameraError);
      }

      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);

        // マイク有効化後、音声レベル監視を開始
        setTimeout(() => {
          const localParticipant = roomRef.current?.localParticipant;
          if (localParticipant && localParticipant.audioTracks) {
            const audioTracks = Array.from(
              localParticipant.audioTracks.values()
            );
            const audioTrack = audioTracks.find(
              (track) => track.source === Track.Source.Microphone
            );

            if (
              audioTrack &&
              audioTrack.track &&
              audioTrack.track.mediaStreamTrack
            ) {
              if (import.meta.env.DEV) {
                console.log("音声レベル監視を開始（マイク有効化後）");
              }
              startAudioLevelMonitoringWithTrack(audioTrack.track);
            } else {
              // 音声トラックが見つからない場合は、少し待ってから再試行
              setTimeout(() => {
                if (startAudioLevelMonitoringRef.current) {
                  startAudioLevelMonitoringRef.current();
                }
              }, 1000);
            }
          }
        }, 500);
      } catch (microphoneError) {
        console.warn("マイク有効化エラー:", microphoneError);
      }

      // カメラ・マイク有効化後の参加者リスト更新
      setTimeout(() => {
        updateParticipants();
      }, 1000);
    } catch (mediaError) {
      console.error("カメラ・マイクアクセスエラー:", mediaError);

      if (
        mediaError.message &&
        mediaError.message.includes("silence detected")
      ) {
        updateParticipants();
        return;
      }

      setError(`メディアアクセスエラー: ${mediaError.message}`);
    }
  }, [updateParticipants, startAudioLevelMonitoringWithTrack]);

  /**
   * カメラとマイクを初期状態に設定する関数
   * ローカル参加者のカメラとマイクをUIの状態に合わせて初期化します。
   * デフォルトはカメラOFF、マイクOFFです。
   */
  const initializeCameraAndMicrophone = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      // カメラの初期状態を設定（デフォルトOFF）
      try {
        await roomRef.current.localParticipant.setCameraEnabled(isVideoEnabled);
        if (import.meta.env.DEV) {
          console.log("カメラを初期化:", isVideoEnabled ? "ON" : "OFF");
        }
      } catch (cameraError) {
        console.warn("カメラ初期化エラー:", cameraError);
      }

      // マイクの初期状態を設定（デフォルトOFF）
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(
          isAudioEnabled
        );
        if (import.meta.env.DEV) {
          console.log("マイクを初期化:", isAudioEnabled ? "ON" : "OFF");
        }

        // マイク有効時のみ音声レベル監視を開始
        if (isAudioEnabled) {
          // 初回の音声トラック検索遅延
          const retryAudioLevelMonitoring = () => {
            if (startAudioLevelMonitoringRef.current) {
              startAudioLevelMonitoringRef.current();
            }
          };

          setTimeout(() => {
            const localParticipant = roomRef.current?.localParticipant;
            if (localParticipant && localParticipant.audioTracks) {
              const audioTracks = Array.from(
                localParticipant.audioTracks.values()
              );
              const audioTrack = audioTracks.find(
                (track) => track.source === Track.Source.Microphone
              );

              if (
                audioTrack &&
                audioTrack.track &&
                audioTrack.track.mediaStreamTrack
              ) {
                if (import.meta.env.DEV) {
                  console.log("音声レベル監視を開始（マイク有効化後）");
                }
                startAudioLevelMonitoringWithTrack(audioTrack.track);
              } else {
                // 音声トラックが見つからない場合は、少し待ってからフォールバック再試行
                setTimeout(
                  retryAudioLevelMonitoring,
                  AUDIO_LEVEL_MONITORING_RETRY_CONFIG.FALLBACK_RETRY_DELAY_MS
                );
              }
            }
          }, AUDIO_LEVEL_MONITORING_RETRY_CONFIG.INITIAL_DELAY_MS);
        }
      } catch (microphoneError) {
        console.warn("マイク初期化エラー:", microphoneError);
      }

      // カメラ・マイク初期化後の参加者リスト更新
      setTimeout(() => {
        updateParticipants();
      }, 1000);
    } catch (mediaError) {
      console.error("カメラ・マイクアクセスエラー:", mediaError);

      if (
        mediaError.message &&
        mediaError.message.includes("silence detected")
      ) {
        updateParticipants();
        return;
      }

      setError(`メディアアクセスエラー: ${mediaError.message}`);
    }
  }, [
    isVideoEnabled,
    isAudioEnabled,
    updateParticipants,
    startAudioLevelMonitoringWithTrack,
  ]);

  /**
   * roomIdとuserNameの参照を更新するuseEffect
   *
   * プロパティの変更時にrefの値を更新し、
   * 非同期処理で最新の値を参照できるようにします。
   */
  useEffect(() => {
    roomIdRef.current = roomId;
    userNameRef.current = userName;
  }, [roomId, userName]);

  /**
   * 音声レベル監視関数の参照を設定するuseEffect
   *
   * 関数の参照をrefに保存し、非同期処理やイベントハンドラーで
   * 最新の関数を参照できるようにします。
   */
  useEffect(() => {
    startAudioLevelMonitoringRef.current = startAudioLevelMonitoring;
    startAudioLevelMonitoringWithTrackRef.current =
      startAudioLevelMonitoringWithTrack;
  }, [startAudioLevelMonitoring, startAudioLevelMonitoringWithTrack]);

  /**
   * LiveKitルームに接続する関数
   *
   * 指定されたルームIDとユーザー名でLiveKitルームに接続します。
   * 接続後、カメラ・マイクの有効化、イベントリスナーの設定、
   * 参加者リストの更新などを行います。
   *
   * 接続に失敗した場合はエラーメッセージを設定し、
   * 再接続を試行します。
   */
  const connectToRoom = useCallback(async () => {
    if (isConnectingRef.current || hasConnectedRef.current) {
      console.log("既に接続中または接続済みです");
      return;
    }

    try {
      isConnectingRef.current = true;
      setIsConnecting(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log("接続開始 - 状態チェック完了:", {
          isConnecting: isConnectingRef.current,
          hasConnected: hasConnectedRef.current,
          roomState: roomRef.current?.state,
        });
      }

      const roomName = generateRoomName(roomIdRef.current);
      const participantName = generateParticipantName(userNameRef.current);

      if (import.meta.env.DEV) {
        console.log("LiveKitルームに接続中:", { roomName, participantName });
      }

      // LiveKit設定を確認
      if (import.meta.env.DEV) {
        console.log("LiveKit設定確認:", {
          serverUrl: LIVEKIT_CONFIG.serverUrl,
          apiKey: LIVEKIT_CONFIG.apiKey ? "設定済み" : "未設定",
          apiSecret: LIVEKIT_CONFIG.apiSecret ? "設定済み" : "未設定",
        });
      }

      // アクセストークンを生成
      const token = await generateAccessToken(roomName, participantName);

      // 既存の接続を切断
      if (roomRef.current) {
        try {
          console.log("既存の接続を切断中...");
          await roomRef.current.disconnect();
          console.log("既存の接続を切断完了");
        } catch (disconnectError) {
          console.warn("既存接続の切断でエラー:", disconnectError);
        }
        roomRef.current = null;
      }

      // 新しいルームインスタンスを作成
      const room = new Room();
      roomRef.current = room;

      if (import.meta.env.DEV) {
        console.log("接続開始:", {
          serverUrl: LIVEKIT_CONFIG.serverUrl,
          participantName,
        });
      }

      // ルームイベントリスナーを設定
      const setupRoomEventListeners = () => {
        // 参加者イベントの統合処理
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log("参加者が接続されました:", participant.identity);
          }
          updateParticipants();

          // 参加者のビデオトラックが既に存在する場合は即座にアタッチ
          setTimeout(() => {
            if (import.meta.env.DEV) {
              console.log(
                "新規参加者のビデオトラック処理を開始:",
                participant.identity
              );
            }
            // updateParticipants()は既に上で呼び出されているため、重複呼び出しを削除
          }, TRACK_ATTACHMENT_DELAY);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          // ===== 観測ログ1: イベント到達とidentity =====
          if (import.meta.env.DEV) {
            console.log("[観測1] ParticipantDisconnected:", {
              timestamp: Date.now(),
              disconnectedIdentity: participant.identity,
              allRemoteParticipants: Array.from(room.remoteParticipants.keys()),
              attachedTracksBefore: Array.from(attachedTracksRef.current),
              remoteVideoRefsBefore: Array.from(remoteVideoRefs.current.keys()),
              participantsCount: participants.length,
              allParticipantIds: participants
                .map((p) => p?.identity)
                .filter(Boolean),
            });
          }

          // ===== 観測ログ4: attachedTracksRefクリーンアップ =====
          const keysBefore = Array.from(attachedTracksRef.current);
          const keysToDelete = Array.from(
            attachedTracksRef.current ?? []
          ).filter((key) => key.startsWith(participant.identity));
          const keysAfter = keysBefore.filter(
            (key) => !keysToDelete.includes(key)
          );

          if (import.meta.env.DEV) {
            console.log("[観測4] attachedTracksRefクリーンアップ:", {
              timestamp: Date.now(),
              participantIdentity: participant.identity,
              keysBefore,
              keysToDelete,
              keysAfter,
              allParticipants: participants
                .map((p) => p?.identity)
                .filter(Boolean),
            });
          }

          // 退出した参加者のリソースをクリーンアップ
          cleanupAudioElement(participant.identity);
          keysToDelete.forEach((key) => attachedTracksRef.current?.delete(key));

          // ===== 観測ログ2: remoteVideoRefs操作 =====
          // React再レンダリング完了後に安全に削除するため、requestAnimationFrameを使用
          requestAnimationFrame(() => {
            const beforeDelete = Array.from(remoteVideoRefs.current.keys());

            // 退出した参加者が本当にいなくなったかを確認してから削除
            if (
              !roomRef.current?.remoteParticipants.has(participant.identity)
            ) {
              remoteVideoRefs.current.delete(participant.identity);
              const afterDelete = Array.from(remoteVideoRefs.current.keys());

              if (import.meta.env.DEV) {
                console.log("[観測2] remoteVideoRefs削除操作:", {
                  timestamp: Date.now(),
                  operation: "delete",
                  deletedIdentity: participant.identity,
                  beforeDelete,
                  afterDelete,
                  allParticipants: participants
                    .map((p) => p?.identity)
                    .filter(Boolean),
                });
              }
            } else if (import.meta.env.DEV) {
              console.log(
                "[観測2] remoteVideoRefs削除スキップ: 参加者がまだ存在します",
                participant.identity
              );
            }
          });

          // updateParticipants()もrequestAnimationFrame内で実行してReact再レンダリングとの競合を回避
          requestAnimationFrame(() => {
            updateParticipants();
          });
        });

        // トラック購読イベントは下記の統合ハンドラーで処理

        // トラックが購読解除された時（統合ハンドラーで処理）

        // ルームから切断された時
        room.on(RoomEvent.Disconnected, (reason) => {
          console.log("ルームから切断:", reason);
          hasConnectedRef.current = false;
          isConnectingRef.current = false;

          // 意図的な切断でない場合のみ再接続を試行
          // reasonは数値で返される: 1=CLIENT_INITIATED, 2=SERVER_SHUTDOWN
          if (reason !== 1 && reason !== 2) {
            console.log("意図しない切断が発生しました。再接続を試行します。");
            setTimeout(() => {
              if (
                !hasConnectedRef.current &&
                !isConnectingRef.current &&
                roomRef.current &&
                connectToRoomRef.current
              ) {
                console.log("再接続を開始します");
                connectToRoomRef.current();
              }
            }, 3000); // 再接続間隔を3秒に延長
          } else {
            console.log("意図的な切断のため、再接続をスキップします。");
          }
        });

        // ローカルトラックが公開された時
        // 注意: LocalTrackPublishedイベントはuseEffect（1494-1537行目）でも処理されるため、
        // ここではオーディオトラックの音声レベル監視のみを処理
        room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
          if (import.meta.env.DEV) {
            console.log(
              "ローカルトラック公開:",
              publication.kind,
              participant.identity
            );
          }
          // ビデオトラックの処理はuseEffect内のハンドラーに任せる（重複を避ける）
          if (publication.kind === "audio" && publication.track) {
            // オーディオトラックが公開されたときに音声レベル監視を開始
            if (import.meta.env.DEV) {
              console.log("オーディオトラック公開検出 - 音声レベル監視を開始");
            }
            setTimeout(() => {
              // 公開されたトラックを直接使用して音声レベル監視を開始
              if (startAudioLevelMonitoringWithTrackRef.current) {
                // 再試行カウンターをリセット
                audioMonitoringRetryCountRef.current = 0;
                startAudioLevelMonitoringWithTrackRef.current(
                  publication.track
                );
              }
            }, 100); // 遅延を500msから100msに短縮
          }
        });

        // ローカルトラックが非公開になった時
        room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
          console.log(
            "ローカルトラック非公開:",
            publication.kind,
            participant.identity
          );
          updateParticipants();
        });

        // 統合トラック購読イベントハンドラー（ビデオ・音声の受信開始）
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (import.meta.env.DEV) {
              console.log(
                "トラック購読完了:",
                track.kind,
                participant.identity
              );
            }

            // ビデオトラックの処理
            if (track.kind === Track.Kind.Video && track) {
              if (import.meta.env.DEV) {
                console.log("ビデオトラック処理開始:", participant.identity);
              }
              // ビデオトラックをアタッチ
              setTimeout(() => {
                if (attachVideoTrackRef.current) {
                  attachVideoTrackRef.current(track, participant, false);
                }
              }, TRACK_ATTACHMENT_DELAY);
            }

            // 音声トラックの処理（即座に実行）
            if (track.kind === Track.Kind.Audio && track) {
              if (import.meta.env.DEV) {
                console.log("音声トラック処理開始:", participant.identity);
              }
              // 音声トラックを即座にアタッチして自動再生（遅延なし）
              attachAudioTrack(track, participant);
            }

            // 参加者リストの更新
            setTimeout(() => {
              updateParticipants();
            }, TRACK_ATTACHMENT_DELAY);
          }
        );

        // 統合トラック非購読イベントハンドラー（音声・ビデオの受信停止）
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track, publication, participant) => {
            // ===== 観測ログ1: イベント到達とidentity =====
            if (import.meta.env.DEV) {
              console.log("[観測1] TrackUnsubscribed:", {
                timestamp: Date.now(),
                participantIdentity: participant.identity,
                trackKind: track.kind,
                trackSid: track.sid,
                publicationKind: publication.kind,
                isSubscribed: publication.isSubscribed,
                allRemoteParticipants: Array.from(
                  room.remoteParticipants.keys()
                ),
                participantsCount: participants.length,
                allParticipantIds: participants
                  .map((p) => p?.identity)
                  .filter(Boolean),
              });
            }

            // 音声トラックが非購読された際に音声要素をクリーンアップ
            if (track.kind === Track.Kind.Audio) {
              cleanupAudioElement(participant.identity);
            }

            // ビデオトラックが非購読された場合の完全なクリーンアップ
            if (track.kind === Track.Kind.Video) {
              // 1. ビデオトラックをdetach
              const videoElement = remoteVideoRefs.current.get(
                participant.identity
              );
              if (videoElement && track) {
                try {
                  track.detach(videoElement);
                  if (import.meta.env.DEV) {
                    console.log(
                      "[観測1] TrackUnsubscribed: ビデオトラックをdetachしました:",
                      participant.identity
                    );
                  }
                } catch (error) {
                  console.warn(
                    "ビデオトラックdetachエラー:",
                    error,
                    participant.identity
                  );
                  // エラーが発生した場合でもsrcObjectをクリア
                  if (videoElement.srcObject) {
                    videoElement.srcObject = null;
                  }
                }
              }

              // 2. attachedTracksRefからトラック記録を削除
              const trackId = `${participant.identity}-${track.kind}-${
                track.sid || track.mediaStreamTrack?.id || "unknown"
              }`;
              if (attachedTracksRef.current.has(trackId)) {
                attachedTracksRef.current.delete(trackId);
                if (import.meta.env.DEV) {
                  console.log(
                    "[観測1] TrackUnsubscribed: トラック記録を削除しました:",
                    trackId
                  );
                }
              }

              // 3. 参加者リストを更新
              setTimeout(() => {
                updateParticipants();
              }, TRACK_ATTACHMENT_DELAY);
            }
          }
        );

        // ルームに接続された時
        room.on(RoomEvent.Connected, () => {
          if (import.meta.env.DEV) {
            console.log("ルーム接続完了イベント受信");
          }
          hasConnectedRef.current = true;
          isConnectingRef.current = false;
          setError(null);

          if (import.meta.env.DEV) {
            console.log("接続完了: カメラ・マイクアクセスを開始");
          }
          initializeCameraAndMicrophone();
        });
      };

      setupRoomEventListeners();

      // ルームに接続
      await room.connect(LIVEKIT_CONFIG.serverUrl, token);

      if (import.meta.env.DEV) {
        console.log("LiveKitルームに接続成功");
      }

      // 接続状態を確認
      if (import.meta.env.DEV) {
        console.log("接続状態確認:", {
          roomState: room.state,
          hasConnected: hasConnectedRef.current,
          isConnecting: isConnectingRef.current,
        });
      }

      // 参加者リストを更新
      setTimeout(() => {
        updateParticipants();
      }, 500);
    } catch (connectError) {
      console.error("接続エラー:", connectError);

      let errorMessage = "接続に失敗しました";
      if (connectError.message.includes("Client initiated disconnect")) {
        errorMessage = "接続が中断されました";
      } else if (connectError.message.includes("WebSocket")) {
        errorMessage = "ネットワーク接続エラー";
      } else {
        errorMessage = `接続エラー: ${connectError.message}`;
      }

      setError(errorMessage);
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    updateParticipants,
    initializeCameraAndMicrophone,
    attachAudioTrack,
    cleanupAudioElement,
  ]);

  /**
   * connectToRoom関数の参照を設定するuseEffect
   *
   * 接続関数の参照をrefに保存し、非同期処理やイベントハンドラーで
   * 最新の関数を参照できるようにします。
   */
  useEffect(() => {
    connectToRoomRef.current = connectToRoom;
  }, [connectToRoom]);

  /**
   * ルームから切断する関数
   *
   * すべての音声要素をクリーンアップし、LiveKitルームから切断します。
   * 状態をリセットし、適切なコールバック関数を呼び出します。
   * エラーが発生してもコールバック関数は実行されます。
   */
  const disconnectFromRoom = useCallback(async () => {
    try {
      // 1. カメラ・マイクストリームの完全停止（PRレビュー対応 - ヘルパー関数使用）
      if (roomRef.current?.localParticipant) {
        stopAllLocalTracks(roomRef.current.localParticipant);
      }

      // 2. 音声要素のクリーンアップ
      for (const participantIdentity of audioElementsRef.current.keys()) {
        cleanupAudioElement(participantIdentity);
      }

      // 3. ビデオ関連のリソースをクリーンアップ
      attachedTracksRef.current.clear(); // アタッチ済みトラック記録をクリア
      remoteVideoRefs.current.clear(); // リモートビデオ要素参照をクリア

      // 4. LiveKitルームから切断
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      // 5. 状態リセット
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
      setParticipants([]);
      setLocalParticipant(null);
      setError(null);

      // 6. コールバック実行
      if (onLeaveRoom) {
        console.log("onLeaveRoomコールバックを実行");
        await onLeaveRoom();
      } else if (onRoomDisconnected) {
        onRoomDisconnected("CLIENT_INITIATED");
      }
    } catch (error) {
      console.error("切断エラー:", error);
      // エラーが発生してもonLeaveRoomを実行
      if (onLeaveRoom) {
        try {
          await onLeaveRoom();
        } catch (leaveError) {
          console.error("onLeaveRoom実行エラー:", leaveError);
        }
      }
    }
  }, [onRoomDisconnected, onLeaveRoom, cleanupAudioElement]);

  /**
   * ビデオ（カメラ）のオン/オフを切り替える関数
   *
   * ローカル参加者のカメラを有効/無効に切り替えます。
   * 状態の変更に失敗した場合はエラーログを出力します。
   */
  const toggleVideo = useCallback(async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) {
      console.error("ルームまたはローカル参加者が存在しません");
      return;
    }

    try {
      const newVideoState = !isVideoEnabled;
      await roomRef.current.localParticipant.setCameraEnabled(newVideoState);
      setIsVideoEnabled(newVideoState);

      if (import.meta.env.DEV) {
        console.log("カメラ状態切り替え:", newVideoState);
      }
    } catch (error) {
      console.error("カメラ切り替えエラー:", error);
    }
  }, [isVideoEnabled]);

  /**
   * オーディオ（マイク）のオン/オフを切り替える関数
   *
   * ローカル参加者のマイクを有効/無効に切り替えます。
   * 状態の変更に失敗した場合はエラーログを出力します。
   */
  const toggleAudio = useCallback(async () => {
    if (!roomRef.current || !roomRef.current.localParticipant) {
      console.error("ルームまたはローカル参加者が存在しません");
      return;
    }

    try {
      const newAudioState = !isAudioEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(
        newAudioState
      );
      setIsAudioEnabled(newAudioState);

      if (import.meta.env.DEV) {
        console.log("マイク状態切り替え:", newAudioState);
      }
    } catch (error) {
      console.error("マイク切り替えエラー:", error);
    }
  }, [isAudioEnabled]);

  // === コンポーネントライフサイクル管理 ===
  // コンポーネントマウント時に接続（依存配列を空にしてリロード時の再実行を防ぐ）
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("VideoCallRoom マウント - 接続開始", {
        roomId: roomIdRef.current,
        userName: userNameRef.current,
      });
    }

    // 既存の接続をクリーンアップ
    if (roomRef.current) {
      if (import.meta.env.DEV) {
        console.log("既存の接続をクリーンアップ");
      }
      try {
        roomRef.current.disconnect();
      } catch (error) {
        console.warn("既存接続のクリーンアップエラー:", error);
      }
      roomRef.current = null;
    }

    // 状態をリセット
    hasConnectedRef.current = false;
    isConnectingRef.current = false;
    setError(null);

    // ユーザーインタラクションを有効化（自動再生制限回避）
    enableUserInteraction();

    // 接続を開始
    const initializeConnection = async () => {
      try {
        if (connectToRoomRef.current) {
          await connectToRoomRef.current();
        }
      } catch (error) {
        console.error("初期接続エラー:", error);
      }
    };

    // 少し遅延させて接続を開始(接続がかぶらないようにする)
    const timeoutId = setTimeout(initializeConnection, 100);

    // クリーンアップ（強化版 - カメラストリーム完全停止）
    return () => {
      if (import.meta.env.DEV) {
        console.log("VideoCallRoom アンマウント - 接続切断", {
          roomId: roomIdRef.current,
          userName: userNameRef.current,
        });
      }
      clearTimeout(timeoutId);

      // 音声レベル監視を停止
      stopAudioLevelMonitoring();

      // カメラ・マイクストリームの完全停止（PRレビュー対応 - ヘルパー関数使用）
      if (roomRef.current?.localParticipant) {
        stopAllLocalTracks(roomRef.current.localParticipant);
        if (import.meta.env.DEV) {
          console.log("アンマウント時: すべてのローカルトラックを停止しました");
        }
      }

      // LiveKitルームから切断
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (error) {
          console.warn("切断時のエラー:", error);
        }
        roomRef.current = null;
      }
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
    };
  }, [enableUserInteraction, stopAudioLevelMonitoring]); // 依存配列にenableUserInteractionとstopAudioLevelMonitoringを指定しているため、マウント時およびこれらが変更されたときに実行される

  // roomIdとuserNameの変更を監視して接続を更新
  useEffect(() => {
    if (!roomId || !userName) return;

    // 既に接続済みで、roomIdとuserNameが同じ場合は何もしない
    if (
      hasConnectedRef.current &&
      roomIdRef.current === roomId &&
      userNameRef.current === userName
    ) {
      return;
    }

    console.log("roomId/userName変更検出 - 接続を更新:", { roomId, userName });

    // 既存の接続を切断
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (error) {
        console.warn("既存接続の切断エラー:", error);
      }
      roomRef.current = null;
    }

    // 状態をリセット
    hasConnectedRef.current = false;
    isConnectingRef.current = false;
    setError(null);

    // 新しい接続を開始
    const initializeNewConnection = async () => {
      try {
        if (connectToRoomRef.current) {
          await connectToRoomRef.current();
        }
      } catch (error) {
        console.error("新しい接続エラー:", error);
      }
    };

    const timeoutId = setTimeout(initializeNewConnection, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [roomId, userName]); // roomIdとuserNameの変更を監視

  // === ビデオ表示管理 ===
  // ビデオ要素の参照管理（上部で定義済み）

  /**
   * ビデオトラックをビデオ要素にアタッチする関数
   *
   * LiveKitのビデオトラックをHTMLのvideo要素に接続します。
   * ローカル参加者とリモート参加者を区別して処理し、
   * 重複アタッチを防ぐためのチェック機能も含みます。
   *
   * @param {Track} track - アタッチするビデオトラック
   * @param {Participant} participant - 参加者（ローカルまたはリモート）
   * @param {boolean} isLocal - ローカル参加者かどうか
   */
  const attachVideoTrack = useCallback((track, participant, isLocal) => {
    if (!track) {
      console.log("トラックが存在しません:", participant.identity);
      return;
    }

    // 重複アタッチをチェック（ローカルトラックは再アタッチを許可）
    // track.sidまたはtrack.mediaStreamTrack.idを含めて一意性を担保
    const trackId = `${participant.identity}-${track.kind}-${
      track.sid || track.mediaStreamTrack?.id || "unknown"
    }`;

    // リモートトラックの重複チェック: videoElementのsrcObjectも確認
    if (attachedTracksRef.current.has(trackId) && !isLocal) {
      const videoElement = remoteVideoRefs.current.get(participant.identity);
      // videoElementが存在し、実際にトラックがアタッチされているか確認
      if (videoElement && videoElement.srcObject) {
        const attachedTracks = videoElement.srcObject.getVideoTracks();
        const hasActiveTrack = attachedTracks.some(
          (t) => t.id === track.mediaStreamTrack?.id || t.readyState === "live"
        );

        if (hasActiveTrack) {
          if (import.meta.env.DEV) {
            console.log(
              "リモートトラックは既にアタッチ済み（確認済み）:",
              trackId
            );
          }
          return;
        } else {
          // 記録はあるが実際にはアタッチされていない → 強制再アタッチ
          if (import.meta.env.DEV) {
            console.log(
              "リモートトラック記録はあるが未アタッチ → 強制再アタッチ:",
              trackId
            );
          }
          attachedTracksRef.current.delete(trackId);
        }
      } else if (!videoElement) {
        // videoElementが存在しない → 記録を削除してスキップ（後でvideoElementが作成されたときに再アタッチされる）
        if (import.meta.env.DEV) {
          console.log(
            "リモートトラック記録はあるがvideoElementなし → 記録削除:",
            trackId
          );
        }
        attachedTracksRef.current.delete(trackId);
        return;
      } else {
        // videoElementはあるがsrcObjectがない → 強制再アタッチ
        if (import.meta.env.DEV) {
          console.log(
            "リモートトラック記録はあるがsrcObjectなし → 強制再アタッチ:",
            trackId
          );
        }
        attachedTracksRef.current.delete(trackId);
      }
    }

    // ローカルトラックの場合は既存のアタッチをクリア
    if (isLocal && attachedTracksRef.current.has(trackId)) {
      if (import.meta.env.DEV) {
        console.log("ローカルトラックの再アタッチ:", trackId);
      }
      attachedTracksRef.current.delete(trackId);
    }

    const videoElement = isLocal
      ? localVideoRef.current
      : remoteVideoRefs.current.get(participant.identity);
    if (!videoElement) {
      console.log(
        "ビデオ要素が存在しません:",
        participant.identity,
        isLocal ? "(ローカル)" : "(リモート)"
      );
      return;
    }

    try {
      if (import.meta.env.DEV) {
        console.log("ビデオトラックアタッチ開始:", {
          participantIdentity: participant.identity,
          isLocal,
          hasTrack: !!track,
          hasMediaStreamTrack: !!track.mediaStreamTrack,
          videoElementReady: !!videoElement,
          trackState: track.mediaStreamTrack?.readyState,
        });
      }

      // 既存のトラックをクリア
      // 注意: リモートトラックに対してstop()を呼ばないこと
      // stop()はローカルトラック専用で、リモートトラックに対して呼ぶと
      // 他参加者のメディアにも影響を与える可能性がある
      if (videoElement.srcObject) {
        if (isLocal) {
          // ローカルトラックのみstop()を呼ぶ
          const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
          attachedVideoTracks.forEach((t) => {
            t.stop();
          });
        }
        // リモートトラックはstop()を呼ばず、srcObjectをクリアするだけ
        videoElement.srcObject = null;
        if (import.meta.env.DEV && !isLocal) {
          console.log(
            "リモートビデオ要素の既存トラックをクリア:",
            participant.identity
          );
        }
      }

      // トラックの状態をチェック
      if (
        track.mediaStreamTrack &&
        track.mediaStreamTrack.readyState === "ended"
      ) {
        console.warn("トラックが終了状態です:", participant.identity);
        return;
      }

      track.attach(videoElement);

      // アタッチ成功を記録
      attachedTracksRef.current.add(trackId);

      if (import.meta.env.DEV) {
        console.log(
          "ビデオトラックアタッチ成功:",
          participant.identity,
          isLocal ? "(ローカル)" : "(リモート)"
        );
      }
    } catch (error) {
      console.error(
        "ビデオトラックアタッチエラー:",
        error,
        participant.identity
      );

      // エラーが発生した場合は条件付きで再試行
      if (
        track.mediaStreamTrack &&
        track.mediaStreamTrack.readyState === "live"
      ) {
        // トラックがまだ有効な場合のみ再試行
        setTimeout(() => {
          try {
            // 既にアタッチされているかチェック
            if (
              !attachedTracksRef.current.has(trackId) &&
              (!videoElement.srcObject ||
                videoElement.srcObject.getTracks().length === 0)
            ) {
              track.attach(videoElement);
              attachedTracksRef.current.add(trackId);
              if (import.meta.env.DEV) {
                console.log(
                  "ビデオトラックアタッチ再試行成功:",
                  participant.identity
                );
              }
            } else if (import.meta.env.DEV) {
              console.log(
                "ビデオトラックは既にアタッチ済み:",
                participant.identity
              );
            }
          } catch (retryError) {
            console.error(
              "ビデオトラックアタッチ再試行エラー:",
              retryError,
              participant.identity
            );
          }
        }, RETRY_ATTACHMENT_DELAY); // リトライ用の遅延時間
      } else if (import.meta.env.DEV) {
        console.log(
          "ビデオトラックが無効なため再試行をスキップ:",
          participant.identity
        );
      }
    }
  }, []);

  /**
   * attachVideoTrack関数の参照を設定するuseEffect
   *
   * ビデオトラックアタッチ関数の参照をrefに保存し、
   * 初期化順序の問題を回避して最新の関数を参照できるようにします。
   */
  useEffect(() => {
    attachVideoTrackRef.current = attachVideoTrack;
  }, [attachVideoTrack]);

  // TrackSubscribedイベントはconnectToRoom内の統合ハンドラーで処理

  // === ローカルビデオトラック管理 ===
  /**
   * ローカルビデオトラックの処理を行うuseEffect
   *
   * ローカル参加者が変更された際に、既存のビデオトラックを
   * チェックして適切にアタッチします。
   */
  useEffect(() => {
    if (!localParticipant || !localVideoRef.current) return;

    // 既存のビデオトラックをチェック
    if (localParticipant.videoTrackPublications) {
      for (const publication of localParticipant.videoTrackPublications.values()) {
        if (publication.track) {
          console.log(
            "既存のローカルビデオトラックをアタッチ:",
            publication.track
          );
          if (attachVideoTrackRef.current) {
            attachVideoTrackRef.current(
              publication.track,
              localParticipant,
              true
            );
          }
          break;
        }
      }
    }
  }, [localParticipant]);

  /**
   * ローカルトラック公開イベントの処理を行うuseEffect
   *
   * ローカルビデオトラックが公開された際に適切なリトライメカニズムで
   * ビデオトラックをアタッチします。
   */
  useEffect(() => {
    if (!roomRef.current || !localParticipant) return;

    const handleLocalTrackPublished = (publication, participant) => {
      if (
        publication.kind === "video" &&
        publication.track &&
        participant.identity === localParticipant.identity
      ) {
        console.log(
          "ローカルビデオトラック公開イベント受信:",
          publication.track
        );

        // 適切なリトライメカニズムでローカルトラックをアタッチ
        const attachLocalVideoTrack = (retryCount = 0, maxRetries = 3) => {
          // 指数バックオフによる遅延計算（50ms, 150ms, 250ms, 300ms）
          const delay = Math.min(
            LOCAL_TRACK_ATTACHMENT_DELAY + retryCount * 100,
            300
          );

          setTimeout(() => {
            if (attachVideoTrackRef.current) {
              try {
                attachVideoTrackRef.current(
                  publication.track,
                  participant,
                  true
                );
                if (import.meta.env.DEV) {
                  console.log(
                    `ローカルビデオトラックアタッチ成功 (試行 ${
                      retryCount + 1
                    })`
                  );
                }
              } catch (error) {
                console.warn(
                  `ローカルビデオトラックアタッチ失敗 (試行 ${
                    retryCount + 1
                  }):`,
                  error
                );
                if (retryCount < maxRetries - 1) {
                  attachLocalVideoTrack(retryCount + 1, maxRetries);
                }
              }
            } else if (retryCount < maxRetries - 1) {
              // attachVideoTrackRefがまだ利用できない場合は再試行
              attachLocalVideoTrack(retryCount + 1, maxRetries);
            }
          }, delay);
        };

        attachLocalVideoTrack();
      }
    };

    roomRef.current.on(
      RoomEvent.LocalTrackPublished,
      handleLocalTrackPublished
    );

    return () => {
      if (roomRef.current) {
        roomRef.current.off(
          RoomEvent.LocalTrackPublished,
          handleLocalTrackPublished
        );
      }
    };
  }, [localParticipant]);

  // === リモートビデオトラック管理 ===
  /**
   * リモートビデオトラックの処理を行うuseEffect
   *
   * 参加者リストが変更された際に、リモート参加者の
   * 既存ビデオトラックをチェックして適切にアタッチします。
   */
  useEffect(() => {
    if (!participants.length || !roomRef.current) return;

    participants.forEach((participant) => {
      if (participant === localParticipant) return; // ローカル参加者はスキップ

      // 退出した参加者は処理しない
      if (!roomRef.current.remoteParticipants.has(participant.identity)) {
        if (import.meta.env.DEV) {
          console.log(
            "リモート参加者のビデオトラックアタッチスキップ: 参加者が既に退出",
            participant.identity
          );
        }
        return;
      }

      // 既存のビデオトラックをチェック
      if (participant.videoTrackPublications) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track && publication.isSubscribed) {
            if (import.meta.env.DEV) {
              console.log("リモート参加者の既存ビデオトラックをアタッチ:", {
                participantIdentity: participant.identity,
                trackSid: publication.track.sid,
                trackState: publication.track.mediaStreamTrack?.readyState,
                hasVideoElement: !!remoteVideoRefs.current.get(
                  participant.identity
                ),
                videoElementSrcObject: !!remoteVideoRefs.current.get(
                  participant.identity
                )?.srcObject,
              });
            }
            // リモートトラック用の遅延でアタッチ（refを使用）
            setTimeout(() => {
              if (
                attachVideoTrackRef.current &&
                remoteVideoRefs.current.get(participant.identity) &&
                roomRef.current?.remoteParticipants.has(participant.identity)
              ) {
                attachVideoTrackRef.current(
                  publication.track,
                  participant,
                  false
                );
              } else if (
                import.meta.env.DEV &&
                !remoteVideoRefs.current.get(participant.identity)
              ) {
                console.log(
                  "リモート参加者のビデオトラックアタッチスキップ: videoElementが未作成",
                  participant.identity
                );
              } else if (
                import.meta.env.DEV &&
                !roomRef.current?.remoteParticipants.has(participant.identity)
              ) {
                console.log(
                  "リモート参加者のビデオトラックアタッチスキップ: 参加者が既に退出",
                  participant.identity
                );
              }
            }, TRACK_ATTACHMENT_DELAY);
            break;
          }
        }
      }
    });
  }, [participants, localParticipant]);

  // === UI レンダリング ===
  /**
   * ローディング画面のレンダリング
   *
   * 接続中の場合に表示されるローディング画面です。
   */
  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">接続中...</h2>
        <p className="text-gray-400">LiveKitルームに接続しています</p>
        <p className="text-gray-500 text-sm mt-2">しばらくお待ちください</p>
      </div>
    );
  }

  /**
   * エラー画面のレンダリング
   *
   * エラーが発生した場合に表示されるエラー画面です。
   * 再接続ボタンも含まれています。
   */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-red-500 text-6xl mb-4">!</div>
        <h2 className="text-xl font-semibold mb-2 text-red-400">接続エラー</h2>
        <p className="text-gray-300 mb-4 text-center">{error}</p>
        <button
          onClick={() => {
            hasConnectedRef.current = false;
            isConnectingRef.current = false;
            setError(null);
            connectToRoom();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          再接続
        </button>
      </div>
    );
  }

  /**
   * メイン画面のレンダリング
   *
   * 正常に接続された場合のメインビデオ通話画面です。
   * 参加者のビデオ表示、コントロールボタン、音声レベル表示を含みます。
   */
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <span className="font-semibold">ビデオ通話</span>
          <span className="text-gray-400">({participants.length}人)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg transition-colors ${
              isVideoEnabled
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={isVideoEnabled ? "カメラをオフ" : "カメラをオン"}
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg transition-colors relative ${
              isAudioEnabled
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={isAudioEnabled ? "マイクをオフ" : "マイクをオン"}
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}

            {/* 音声レベルインジケーター */}
            {isAudioEnabled && isSpeaking && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </button>

          {/* 退出ボタンは削除済み: ゲストは「ルーム一覧に戻る」ボタンで十分 */}
        </div>
      </div>

      {/* ビデオエリア */}
      <div className="flex-1 p-4">
        {participants.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>参加者を待機中...</p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-4 h-full ${
              participants.length === 1
                ? "grid-cols-1"
                : participants.length === 2
                ? "grid-cols-2"
                : participants.length === 3
                ? "grid-cols-2 grid-rows-2"
                : participants.length === 4
                ? "grid-cols-2 grid-rows-2"
                : participants.length <= 6
                ? "grid-cols-3 grid-rows-2"
                : "grid-cols-4 grid-rows-2"
            }`}
          >
            {participants.map((participant, index) => {
              const isLocal =
                participant.identity === localParticipant?.identity;

              // カメラが有効かどうかを判定
              const hasActiveCamera = isLocal
                ? isVideoEnabled
                : (() => {
                    // リモート参加者の場合、videoTrackPublicationsをチェック
                    if (
                      participant.videoTrackPublications &&
                      participant.videoTrackPublications.size > 0
                    ) {
                      for (const publication of participant.videoTrackPublications.values()) {
                        if (publication.isSubscribed && publication.track) {
                          return true;
                        }
                      }
                    }
                    return false;
                  })();

              return (
                <div
                  key={`${participant.identity}-${index}`}
                  className="relative bg-gray-800 rounded-lg overflow-hidden"
                >
                  <video
                    ref={
                      isLocal
                        ? localVideoRef
                        : (el) => {
                            // ===== 観測ログ3: JSX refコールバック =====
                            // 注意: participantsはレンダリング時に最新値が使用されるため、ログは最新の参加者リストを反映
                            if (import.meta.env.DEV) {
                              // console.log("[観測3] JSX ref callback:", {
                              //   timestamp: Date.now(),
                              //   el: el ? "exists" : "null",
                              //   participantIdentity: participant?.identity,
                              //   isLocal,
                              //   allParticipants: participants
                              //     .map((p) => p?.identity)
                              //     .filter(Boolean),
                              //   remoteVideoRefsSize:
                              //     remoteVideoRefs.current.size,
                              //   remoteVideoRefsKeys: Array.from(
                              //     remoteVideoRefs.current.keys()
                              //   ),
                              // });
                            }

                            // JSX refでの削除は禁止 - ParticipantDisconnectedイベントでのみ削除
                            // React再レンダリング時にel=nullが呼ばれ、残存参加者のビデオ要素が誤って削除されるのを防ぐため
                            // ログ分析結果: user2のremoteVideoRefsが誤って削除されていた（原因候補A3確定）
                            if (el) {
                              remoteVideoRefs.current.set(
                                participant.identity,
                                el
                              );
                              if (import.meta.env.DEV) {
                                // console.log("[観測3] JSX ref set:", {
                                //   timestamp: Date.now(),
                                //   participantIdentity: participant?.identity,
                                //   remoteVideoRefsKeys: Array.from(
                                //     remoteVideoRefs.current.keys()
                                //   ),
                                // });
                              }
                            }
                            // else句での削除処理を削除 - これが残存参加者のカメラ消失の根本原因
                          }
                    }
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                    onLoadedData={() => {
                      if (import.meta.env.DEV && videoLogCountRef.current < 5) {
                        videoLogCountRef.current++;
                        console.log(
                          "ビデオ要素のデータ読み込み完了:",
                          participant.identity
                        );
                      }
                    }}
                    onError={(e) => {
                      console.error(
                        "ビデオ要素エラー:",
                        e,
                        participant.identity
                      );
                    }}
                  />

                  {/* カメラがオフの時にVideoOffアイコンを表示 */}
                  {!hasActiveCamera && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <VideoOff className="w-16 h-16 text-gray-600 opacity-50" />
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                    {participant?.identity || "Unknown"}
                    {isLocal && " (あなた)"}
                  </div>

                  {/* 音声レベル表示（ローカル参加者のみ） */}
                  {isLocal && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      {/* 音声レベルバー */}
                      <div className="flex items-end gap-1 h-6">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full transition-all duration-150 ${
                              audioLevel > (i + 1) * 20
                                ? isSpeaking
                                  ? "bg-green-400 h-full"
                                  : "bg-yellow-400 h-full"
                                : "bg-gray-600 h-1"
                            }`}
                          />
                        ))}
                      </div>

                      {/* 話している状態のインジケーター */}
                      {isSpeaking && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400 font-medium">
                            話し中
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* カメラ・マイク状態表示（ローカル参加者のみ） */}
                  {isLocal && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      {!isVideoEnabled && (
                        <div className="bg-red-500 text-white px-2 py-1 rounded text-xs">
                          <VideoOff className="w-3 h-3" />
                        </div>
                      )}
                      {!isAudioEnabled && (
                        <div className="bg-red-500 text-white px-2 py-1 rounded text-xs">
                          <MicOff className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// === コンポーネント最適化 ===
/**
 * メモ化によるパフォーマンス最適化
 *
 * propsの変更時のみ再レンダリングを行うようにメモ化し、
 * 不要な再レンダリングを防いでパフォーマンスを向上させます。
 */
export default memo(VideoCallRoom, (prevProps, nextProps) => {
  return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.userName === nextProps.userName
  );
});
