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
import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { 
  Room, 
  RoomEvent, 
  RemoteParticipant, 
  LocalParticipant,
  Track
} from 'livekit-client';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Users
} from 'lucide-react';
import { LIVEKIT_CONFIG, generateRoomName, generateParticipantName, generateAccessToken } from '../config/livekit';


// =============================================
// Configuration constants
// =============================================
/**
 * LiveKit接続やUI動作に関わる遅延・しきい値の定義。
 * 値を一箇所に集約し、デバッグ/調整を容易にする。
 */
const TRACK_ATTACHMENT_DELAY = 50; // ms - リモートトラックのアタッチ遅延（短縮）
const LOCAL_TRACK_ATTACHMENT_DELAY = 20; // ms - ローカルトラックのアタッチ遅延（短縮）
const RETRY_ATTACHMENT_DELAY = 100; // ms - リトライ時のアタッチ遅延（短縮）
const AUDIO_LEVEL_NORMALIZER = 128; // 音声レベル正規化用の除数
const SPEAKING_THRESHOLD = 3; // 話していると判定する音声レベル閾値


function VideoCallRoom({ roomId, userName, onRoomDisconnected, onLeaveRoom }) {
  // =============================================
  // State management
  // =============================================
  const [participants, setParticipants] = useState([]); // 参加者リスト
  const [localParticipant, setLocalParticipant] = useState(null); // ローカル参加者
  const [isConnecting, setIsConnecting] = useState(false); // 接続中フラグ
  const [error, setError] = useState(null); // エラー状態
  const [isVideoEnabled, setIsVideoEnabled] = useState(true); // ビデオ有効状態
  const [isAudioEnabled, setIsAudioEnabled] = useState(true); // オーディオ有効状態
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
      const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const silentAudio = new Audio(silentAudioData);
      silentAudio.volume = 0.01; // 音量を最小に設定
      
      // 無音音声を再生してユーザーインタラクションを記録
      silentAudio.play().then(() => {
        userInteractionEnabledRef.current = true;
        if (import.meta.env.DEV) {
          console.log('ユーザーインタラクション有効化完了');
        }
        // 音声レベル監視を開始
        setTimeout(() => {
          if (startAudioLevelMonitoringRef.current) {
            startAudioLevelMonitoringRef.current();
          }
        }, 100);
      }).catch((error) => {
        if (import.meta.env.DEV) {
          console.log('無音音声再生失敗（通常は問題なし）:', error);
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
        silentAudio.src = '';
      }, 100);
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('ユーザーインタラクション有効化エラー:', error);
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
      console.log('ユーザーインタラクション待機中...');
      return;
    }

    try {
      // AudioContextを初期化（ユーザーインタラクション後に実行）
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      // AudioContextが停止状態の場合は再開
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(error => {
          console.warn('AudioContext再開エラー:', error);
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
        const isCurrentlySpeaking = normalizedLevel > (SPEAKING_THRESHOLD / 100);
        if (isCurrentlySpeaking !== isSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      console.log('音声レベル監視を開始しました');
    } catch (error) {
      console.warn('音声レベル監視開始エラー:', error);
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

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    console.log('音声レベル監視を停止しました');
  }, []);

  /**
   * トラックを指定して音声レベル監視を開始する関数
   * 
   * ローカルオーディオトラックをAudioContextに接続して
   * 音声レベル監視を開始します。
   */
  const startAudioLevelMonitoringWithTrack = useCallback((track) => {
    if (!track || !track.mediaStreamTrack) {
      console.warn('音声トラックが無効です');
      return;
    }

    // ユーザーインタラクションが有効でない場合は待機
    if (!userInteractionEnabledRef.current) {
      console.log('ユーザーインタラクション待機中...');
      return;
    }

    try {
      // AudioContextを初期化
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      // AudioContextが停止状態の場合は再開
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(error => {
          console.warn('AudioContext再開エラー:', error);
        });
      }

      // AnalyserNodeを作成
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      // 音声トラックをAudioContextに接続
      const source = audioContextRef.current.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
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
        const isCurrentlySpeaking = normalizedLevel > (SPEAKING_THRESHOLD / 100);
        if (isCurrentlySpeaking !== isSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      console.log('トラック指定音声レベル監視を開始しました');
    } catch (error) {
      console.warn('トラック指定音声レベル監視開始エラー:', error);
    }
  }, [isSpeaking]);

  // refに関数を設定
  startAudioLevelMonitoringRef.current = startAudioLevelMonitoring;
  startAudioLevelMonitoringWithTrackRef.current = startAudioLevelMonitoringWithTrack;
  
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
      ...Array.from(roomRef.current.remoteParticipants.values())
    ].filter(p => p);

    setParticipants(prevParticipants => {
      if (prevParticipants.length !== allParticipants.length) {
        return allParticipants;
      }
      
      const prevIds = prevParticipants.map(p => p.identity).sort();
      const newIds = allParticipants.map(p => p.identity).sort();
      if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
        return allParticipants;
      }
      
      return prevParticipants;
    });
    
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
  const attachAudioTrack = useCallback((track, participant) => {
    if (!track || !participant) {
      console.warn('音声トラックまたは参加者が無効です');
      return;
    }

    try {
      // 既存の音声要素をチェック（重複作成を防ぐ）
      const existingElement = audioElementsRef.current.get(participant.identity);
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
        existingElement.style.display = 'none'; // 非表示のまま
        if (import.meta.env.DEV) {
          console.log('既存の音声要素を更新:', participant.identity);
        }
        return;
      }

      // 新しいHTML音声要素を作成
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;        // 自動再生を有効化
      audioElement.playsInline = true;     // インライン再生（モバイル対応）
      audioElement.muted = false;          // ミュートを解除
      audioElement.volume = 1.0;           // 音量を最大に設定
      
      // 音声ストリームを設定（MediaStreamの場合はpreloadとcrossOriginは効果なし）
      audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
      
      // 音声要素をDOMに追加（非表示で管理）
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      // 参加者IDをキーとして音声要素の参照を保存
      audioElementsRef.current.set(participant.identity, audioElement);

      // 音声の再生を開始
      const playAudioSafely = async () => {
        try {
          await audioElement.play();
          if (import.meta.env.DEV) {
            console.log('音声再生成功:', participant.identity);
          }
        } catch (error) {
          console.warn('音声再生エラー:', error);
          
          // ブラウザの自動再生制限への対応
          if (error.name === 'NotAllowedError') {
            console.log('音声再生にはユーザーインタラクションが必要です');
            
            // ユーザーインタラクションを有効化
            enableUserInteraction();
            
            // 複数のタイミングで再試行（間隔を短縮）
            const retryTimes = [50, 100, 200, 500, 1000];
            let retryIndex = 0;
            
            const retryPlay = () => {
              if (retryIndex < retryTimes.length) {
                setTimeout(() => {
                  audioElement.play().catch(e => {
                    console.warn(`音声再生再試行 ${retryIndex + 1} 失敗:`, e);
                    retryIndex++;
                    retryPlay();
                  });
                }, retryTimes[retryIndex]);
              }
            };
            
            // ユーザーインタラクションイベントを監視
            const handleUserInteraction = () => {
              audioElement.play().catch(e => console.warn('ユーザーインタラクション後の音声再生失敗:', e));
            };
            
            // 複数のイベントを監視
            document.addEventListener('click', handleUserInteraction, { once: true });
            document.addEventListener('touchstart', handleUserInteraction, { once: true });
            document.addEventListener('keydown', handleUserInteraction, { once: true });
            document.addEventListener('mousemove', handleUserInteraction, { once: true });
            
            // バックグラウンドで再試行
            retryPlay();
          }
        }
      };
      
      playAudioSafely();

      if (import.meta.env.DEV) {
        console.log('音声トラックをアタッチ:', participant.identity, {
          hasMediaStreamTrack: !!track.mediaStreamTrack,
          audioElementCreated: !!audioElement,
          autoplay: audioElement.autoplay,
          muted: audioElement.muted,
          volume: audioElement.volume
        });
      }

    } catch (error) {
      console.error('音声トラックアタッチエラー:', error);
    }
  }, [enableUserInteraction]);

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
      audioElement.style.display = 'none';
      // 参照マップからは削除しない（要素を保持）
      // audioElementsRef.current.delete(participantIdentity);
      
      if (import.meta.env.DEV) {
        console.log('音声要素を一時無効化:', participantIdentity);
      }
    }
  }, []);

  /**
   * カメラとマイクを有効化する関数
   * 
   * ローカル参加者のカメラとマイクを有効化し、
   * メディアアクセスエラーの適切な処理を行います。
   */
  const enableCameraAndMicrophone = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      try {
        await roomRef.current.localParticipant.setCameraEnabled(true);
      } catch (cameraError) {
        console.warn('カメラ有効化エラー:', cameraError);
      }

      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
        
        // マイク有効化後、音声レベル監視を開始
        setTimeout(() => {
          const localParticipant = roomRef.current?.localParticipant;
          if (localParticipant && localParticipant.audioTracks) {
            const audioTracks = Array.from(localParticipant.audioTracks.values());
            const audioTrack = audioTracks.find(track => track.source === Track.Source.Microphone);
            
            if (audioTrack && audioTrack.track && audioTrack.track.mediaStreamTrack) {
              if (import.meta.env.DEV) {
                console.log('音声レベル監視を開始（マイク有効化後）');
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
        console.warn('マイク有効化エラー:', microphoneError);
      }

            // カメラ・マイク有効化後の参加者リスト更新
            setTimeout(() => {
              updateParticipants();
            }, 1000);
      
      } catch (mediaError) {
      console.error('カメラ・マイクアクセスエラー:', mediaError);
        
        if (mediaError.message && mediaError.message.includes('silence detected')) {
          updateParticipants();
          return;
        }
        
      setError(`メディアアクセスエラー: ${mediaError.message}`);
    }
  }, [updateParticipants, startAudioLevelMonitoringWithTrack]);




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
    startAudioLevelMonitoringWithTrackRef.current = startAudioLevelMonitoringWithTrack;
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
      console.log('既に接続中または接続済みです');
      return;
    }

    try {
      isConnectingRef.current = true;
      setIsConnecting(true);
      setError(null);

    if (import.meta.env.DEV) {
    console.log('接続開始 - 状態チェック完了:', {
        isConnecting: isConnectingRef.current,
      hasConnected: hasConnectedRef.current,
      roomState: roomRef.current?.state
    });
    }

      const roomName = generateRoomName(roomIdRef.current);
      const participantName = generateParticipantName(userNameRef.current);

      if (import.meta.env.DEV) {
      console.log('LiveKitルームに接続中:', { roomName, participantName });
      }

      // LiveKit設定を確認
      if (import.meta.env.DEV) {
      console.log('LiveKit設定確認:', {
        serverUrl: LIVEKIT_CONFIG.serverUrl,
        apiKey: LIVEKIT_CONFIG.apiKey ? '設定済み' : '未設定',
        apiSecret: LIVEKIT_CONFIG.apiSecret ? '設定済み' : '未設定'
      });
      }

      // アクセストークンを生成
      const token = await generateAccessToken(roomName, participantName);

      // 既存の接続を切断
      if (roomRef.current) {
        try {
        console.log('既存の接続を切断中...');
          await roomRef.current.disconnect();
          console.log('既存の接続を切断完了');
        } catch (disconnectError) {
          console.warn('既存接続の切断でエラー:', disconnectError);
        }
        roomRef.current = null;
      }

      // 新しいルームインスタンスを作成
      const room = new Room();
      roomRef.current = room;

      if (import.meta.env.DEV) {
      console.log('接続開始:', { serverUrl: LIVEKIT_CONFIG.serverUrl, participantName });
      }
      
      // ルームイベントリスナーを設定
      const setupRoomEventListeners = () => {
        // 参加者イベントの統合処理
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('参加者が接続されました:', participant.identity);
          }
          updateParticipants();
          
          // 参加者のビデオトラックが既に存在する場合は即座にアタッチ
          setTimeout(() => {
            if (import.meta.env.DEV) {
              console.log('新規参加者のビデオトラック処理を開始:', participant.identity);
            }
            // updateParticipants()は既に上で呼び出されているため、重複呼び出しを削除
          }, TRACK_ATTACHMENT_DELAY);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('参加者が切断されました:', participant.identity);
          }
          // 退出した参加者のリソースをクリーンアップ
          cleanupAudioElement(participant.identity);
          
          // 退出した参加者のアタッチ済みトラック記録をクリーンアップ
          const keysToDelete = Array.from(attachedTracksRef.current ?? []).filter(key => key.startsWith(participant.identity));
          keysToDelete.forEach(key => attachedTracksRef.current?.delete(key));
          
          // リモートビデオ要素の参照もクリーンアップ
          remoteVideoRefs.current.delete(participant.identity);
          
          updateParticipants();
        });

        // トラック購読イベントは下記の統合ハンドラーで処理

        // トラックが購読解除された時（統合ハンドラーで処理）

        // ルームから切断された時
        room.on(RoomEvent.Disconnected, (reason) => {
          console.log('ルームから切断:', reason);
          hasConnectedRef.current = false;
          isConnectingRef.current = false;
          
          // 意図的な切断でない場合のみ再接続を試行
          // reasonは数値で返される: 1=CLIENT_INITIATED, 2=SERVER_SHUTDOWN
          if (reason !== 1 && reason !== 2) {
            console.log('意図しない切断が発生しました。再接続を試行します。');
      setTimeout(() => {
              if (!hasConnectedRef.current && !isConnectingRef.current && roomRef.current && connectToRoomRef.current) {
                console.log('再接続を開始します');
                connectToRoomRef.current();
              }
            }, 3000); // 再接続間隔を3秒に延長
          } else {
            console.log('意図的な切断のため、再接続をスキップします。');
          }
        });

        // ローカルトラックが公開された時
        room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
          if (import.meta.env.DEV) {
            console.log('ローカルトラック公開:', publication.kind, participant.identity);
          }
          if (publication.kind === 'video' && publication.track) {
            // ビデオトラック公開時は参加者リスト更新を最小限に
            if (import.meta.env.DEV) {
              console.log('ビデオトラック公開検出');
            }
            // ローカルビデオトラックを即座にアタッチ（refを使用）
            setTimeout(() => {
              if (attachVideoTrackRef.current) {
                attachVideoTrackRef.current(publication.track, participant, true);
              }
            }, LOCAL_TRACK_ATTACHMENT_DELAY); // ローカルトラックは短い遅延で即座にアタッチ
            } else if (publication.kind === 'audio' && publication.track) {
              // オーディオトラックが公開されたときに音声レベル監視を開始
              if (import.meta.env.DEV) {
                console.log('オーディオトラック公開検出 - 音声レベル監視を開始');
              }
              setTimeout(() => {
                // 公開されたトラックを直接使用して音声レベル監視を開始
                if (startAudioLevelMonitoringWithTrackRef.current) {
                  // 再試行カウンターをリセット
                  audioMonitoringRetryCountRef.current = 0;
                  startAudioLevelMonitoringWithTrackRef.current(publication.track);
                }
              }, 100); // 遅延を500msから100msに短縮
          }
        });

        // ローカルトラックが非公開になった時
        room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
          console.log('ローカルトラック非公開:', publication.kind, participant.identity);
        updateParticipants();
        });


        // 統合トラック購読イベントハンドラー（ビデオ・音声の受信開始）
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (import.meta.env.DEV) {
            console.log('トラック購読完了:', track.kind, participant.identity);
          }
          
          // ビデオトラックの処理
          if (track.kind === Track.Kind.Video && track) {
            if (import.meta.env.DEV) {
              console.log('ビデオトラック処理開始:', participant.identity);
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
              console.log('音声トラック処理開始:', participant.identity);
            }
            // 音声トラックを即座にアタッチして自動再生（遅延なし）
            attachAudioTrack(track, participant);
          }
          
          // 参加者リストの更新
          setTimeout(() => {
            updateParticipants();
          }, TRACK_ATTACHMENT_DELAY);
        });

        // 統合トラック非購読イベントハンドラー（音声・ビデオの受信停止）
        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (import.meta.env.DEV) {
            console.log('トラック購読解除:', {
              trackKind: track.kind,
              participantIdentity: participant.identity,
              publicationKind: publication.kind,
              isSubscribed: publication.isSubscribed
            });
          }
          
          // 音声トラックが非購読された際に音声要素をクリーンアップ
          if (track.kind === Track.Kind.Audio) {
            cleanupAudioElement(participant.identity);
          }
          
          // ビデオトラックが非購読された場合は参加者リストを更新
          if (track.kind === Track.Kind.Video) {
            setTimeout(() => {
              updateParticipants();
            }, TRACK_ATTACHMENT_DELAY);
          }
        });

        // ルームに接続された時
        room.on(RoomEvent.Connected, () => {
          if (import.meta.env.DEV) {
          console.log('ルーム接続完了イベント受信');
        }
          hasConnectedRef.current = true;
          isConnectingRef.current = false;
          setError(null);
          
          if (import.meta.env.DEV) {
            console.log('接続完了: カメラ・マイクアクセスを開始');
          }
          enableCameraAndMicrophone();
        });
      };

      setupRoomEventListeners();

      // ルームに接続
      await room.connect(LIVEKIT_CONFIG.serverUrl, token);

        if (import.meta.env.DEV) {
          console.log('LiveKitルームに接続成功');
        }

      // 接続状態を確認
      if (import.meta.env.DEV) {
      console.log('接続状態確認:', {
          roomState: room.state,
        hasConnected: hasConnectedRef.current,
        isConnecting: isConnectingRef.current
      });
      }

      // 参加者リストを更新
      setTimeout(() => {
        updateParticipants();
      }, 500);

    } catch (connectError) {
      console.error('接続エラー:', connectError);
      
      let errorMessage = '接続に失敗しました';
      if (connectError.message.includes('Client initiated disconnect')) {
        errorMessage = '接続が中断されました';
      } else if (connectError.message.includes('WebSocket')) {
        errorMessage = 'ネットワーク接続エラー';
      } else {
        errorMessage = `接続エラー: ${connectError.message}`;
      }
      
      setError(errorMessage);
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
  }, [updateParticipants, enableCameraAndMicrophone, attachAudioTrack, cleanupAudioElement]);

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
      // 音声要素のクリーンアップ
      for (const participantIdentity of audioElementsRef.current.keys()) {
        cleanupAudioElement(participantIdentity);
      }
      
      // ビデオ関連のリソースをクリーンアップ
      attachedTracksRef.current.clear(); // アタッチ済みトラック記録をクリア
      remoteVideoRefs.current.clear();   // リモートビデオ要素参照をクリア
      
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
      setParticipants([]);
      setLocalParticipant(null);
      setError(null);
      // onLeaveRoomが提供されている場合はそれを使用、そうでなければonRoomDisconnectedを使用
      if (onLeaveRoom) {
        console.log('onLeaveRoomコールバックを実行');
        await onLeaveRoom();
      } else if (onRoomDisconnected) {
        onRoomDisconnected('CLIENT_INITIATED');
      }
    } catch (error) {
      console.error('切断エラー:', error);
      // エラーが発生してもonLeaveRoomを実行
      if (onLeaveRoom) {
        try {
          await onLeaveRoom();
        } catch (leaveError) {
          console.error('onLeaveRoom実行エラー:', leaveError);
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
      console.error('ルームまたはローカル参加者が存在しません');
      return;
    }

    try {
      const newVideoState = !isVideoEnabled;
      await roomRef.current.localParticipant.setCameraEnabled(newVideoState);
      setIsVideoEnabled(newVideoState);
      
      if (import.meta.env.DEV) {
        console.log('カメラ状態切り替え:', newVideoState);
      }
    } catch (error) {
      console.error('カメラ切り替えエラー:', error);
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
      console.error('ルームまたはローカル参加者が存在しません');
      return;
    }

    try {
      const newAudioState = !isAudioEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(newAudioState);
      setIsAudioEnabled(newAudioState);
      
      if (import.meta.env.DEV) {
        console.log('マイク状態切り替え:', newAudioState);
      }
    } catch (error) {
      console.error('マイク切り替えエラー:', error);
    }
  }, [isAudioEnabled]);

    // === コンポーネントライフサイクル管理 ===
    // コンポーネントマウント時に接続（依存配列を空にしてリロード時の再実行を防ぐ）
    useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('VideoCallRoom マウント - 接続開始', { roomId: roomIdRef.current, userName: userNameRef.current });
    }
    
    // 既存の接続をクリーンアップ
    if (roomRef.current) {
      if (import.meta.env.DEV) {
        console.log('既存の接続をクリーンアップ');
      }
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
    
    // ユーザーインタラクションを有効化（自動再生制限回避）
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
    
    // 少し遅延させて接続を開始(接続がかぶらないようにする)
    const timeoutId = setTimeout(initializeConnection, 100);

      // クリーンアップ
      return () => {
      if (import.meta.env.DEV) {
        console.log('VideoCallRoom アンマウント - 接続切断', { roomId: roomIdRef.current, userName: userNameRef.current });
        }
      clearTimeout(timeoutId);
      
      // 音声レベル監視を停止
      stopAudioLevelMonitoring();
      
        if (roomRef.current) {
          try {
            roomRef.current.disconnect();
          } catch (error) {
          console.warn('切断時のエラー:', error);
          }
          roomRef.current = null;
        }
        hasConnectedRef.current = false;
        isConnectingRef.current = false;
    };
  }, [enableUserInteraction, stopAudioLevelMonitoring]); // 依存配列を空にして、マウント時のみ実行（リロード時の再実行を防ぐ）

  // roomIdとuserNameの変更を監視して接続を更新
  useEffect(() => {
    if (!roomId || !userName) return;
    
    // 既に接続済みで、roomIdとuserNameが同じ場合は何もしない
    if (hasConnectedRef.current && 
        roomIdRef.current === roomId && 
        userNameRef.current === userName) {
      return;
    }
    
    console.log('roomId/userName変更検出 - 接続を更新:', { roomId, userName });
    
    // 既存の接続を切断
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (error) {
        console.warn('既存接続の切断エラー:', error);
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
        console.error('新しい接続エラー:', error);
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
      console.log('トラックが存在しません:', participant.identity);
      return;
    }

    // 重複アタッチをチェック（ローカルトラックは再アタッチを許可）
    // track.sidまたはtrack.mediaStreamTrack.idを含めて一意性を担保
    const trackId = `${participant.identity}-${track.kind}-${track.sid || track.mediaStreamTrack?.id || 'unknown'}`;
    if (attachedTracksRef.current.has(trackId) && !isLocal) {
      if (import.meta.env.DEV) {
        console.log('リモートトラックは既にアタッチ済み:', trackId);
      }
      return;
    }
    
    // ローカルトラックの場合は既存のアタッチをクリア
    if (isLocal && attachedTracksRef.current.has(trackId)) {
      if (import.meta.env.DEV) {
        console.log('ローカルトラックの再アタッチ:', trackId);
      }
      attachedTracksRef.current.delete(trackId);
    }

    const videoElement = isLocal ? localVideoRef.current : remoteVideoRefs.current.get(participant.identity);
    if (!videoElement) {
      console.log('ビデオ要素が存在しません:', participant.identity, isLocal ? '(ローカル)' : '(リモート)');
      return;
    }

    try {
      if (import.meta.env.DEV) {
        console.log('ビデオトラックアタッチ開始:', {
          participantIdentity: participant.identity,
          isLocal,
          hasTrack: !!track,
          hasMediaStreamTrack: !!track.mediaStreamTrack,
          videoElementReady: !!videoElement,
          trackState: track.mediaStreamTrack?.readyState
        });
      }

      // ローカルトラックの場合は既存のトラックをデタッチ
      if (isLocal && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      
      // トラックの状態をチェック
      if (track.mediaStreamTrack && track.mediaStreamTrack.readyState === 'ended') {
        console.warn('トラックが終了状態です:', participant.identity);
        return;
      }
      
      track.attach(videoElement);
      
      // アタッチ成功を記録
      attachedTracksRef.current.add(trackId);
      
      if (import.meta.env.DEV) {
        console.log('ビデオトラックアタッチ成功:', participant.identity, isLocal ? '(ローカル)' : '(リモート)');
      }
    } catch (error) {
      console.error('ビデオトラックアタッチエラー:', error, participant.identity);
      
      // エラーが発生した場合は条件付きで再試行
      if (track.mediaStreamTrack && track.mediaStreamTrack.readyState === 'live') {
        // トラックがまだ有効な場合のみ再試行
        setTimeout(() => {
          try {
            // 既にアタッチされているかチェック
            if (!attachedTracksRef.current.has(trackId) && (!videoElement.srcObject || videoElement.srcObject.getTracks().length === 0)) {
              track.attach(videoElement);
              attachedTracksRef.current.add(trackId);
              if (import.meta.env.DEV) {
                console.log('ビデオトラックアタッチ再試行成功:', participant.identity);
              }
            } else if (import.meta.env.DEV) {
              console.log('ビデオトラックは既にアタッチ済み:', participant.identity);
            }
          } catch (retryError) {
            console.error('ビデオトラックアタッチ再試行エラー:', retryError, participant.identity);
          }
        }, RETRY_ATTACHMENT_DELAY); // リトライ用の遅延時間
      } else if (import.meta.env.DEV) {
        console.log('ビデオトラックが無効なため再試行をスキップ:', participant.identity);
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
          console.log('既存のローカルビデオトラックをアタッチ:', publication.track);
          if (attachVideoTrackRef.current) {
            attachVideoTrackRef.current(publication.track, localParticipant, true);
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
      if (publication.kind === 'video' && publication.track && participant.identity === localParticipant.identity) {
        console.log('ローカルビデオトラック公開イベント受信:', publication.track);
        
        // 適切なリトライメカニズムでローカルトラックをアタッチ
        const attachLocalVideoTrack = (retryCount = 0, maxRetries = 3) => {
          // 指数バックオフによる遅延計算（50ms, 150ms, 250ms, 300ms）
          const delay = Math.min(LOCAL_TRACK_ATTACHMENT_DELAY + (retryCount * 100), 300);
          
          setTimeout(() => {
            if (attachVideoTrackRef.current) {
              try {
                attachVideoTrackRef.current(publication.track, participant, true);
                if (import.meta.env.DEV) {
                  console.log(`ローカルビデオトラックアタッチ成功 (試行 ${retryCount + 1})`);
                }
              } catch (error) {
                console.warn(`ローカルビデオトラックアタッチ失敗 (試行 ${retryCount + 1}):`, error);
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

    roomRef.current.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);

    return () => {
      if (roomRef.current) {
        roomRef.current.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
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
    if (!participants.length) return;

    participants.forEach(participant => {
      if (participant === localParticipant) return; // ローカル参加者はスキップ

      // 既存のビデオトラックをチェック
      if (participant.videoTrackPublications) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track && publication.isSubscribed) {
            if (import.meta.env.DEV) {
              console.log('リモート参加者の既存ビデオトラックをアタッチ:', participant.identity);
            }
            // リモートトラック用の遅延でアタッチ（refを使用）
            setTimeout(() => {
              if (attachVideoTrackRef.current) {
                attachVideoTrackRef.current(publication.track, participant, false);
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
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isVideoEnabled ? 'カメラをオフ' : 'カメラをオン'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg transition-colors relative ${
              isAudioEnabled 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isAudioEnabled ? 'マイクをオフ' : 'マイクをオン'}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            
            {/* 音声レベルインジケーター */}
            {isAudioEnabled && isSpeaking && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </button>
          
          <button
            onClick={disconnectFromRoom}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
            title="通話を終了"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
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
          <div className={`grid gap-4 h-full ${
            participants.length === 1 ? 'grid-cols-1' :
            participants.length === 2 ? 'grid-cols-2' :
            participants.length === 3 ? 'grid-cols-2 grid-rows-2' :
            participants.length === 4 ? 'grid-cols-2 grid-rows-2' :
            participants.length <= 6 ? 'grid-cols-3 grid-rows-2' :
            'grid-cols-4 grid-rows-2'
          }`}>
            {participants.map((participant, index) => {
              const isLocal = participant.identity === localParticipant?.identity;
              return (
                <div key={`${participant.identity}-${index}`} className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={isLocal ? localVideoRef : (el) => {
                      if (el) {
                        remoteVideoRefs.current.set(participant.identity, el);
      } else {
                        remoteVideoRefs.current.delete(participant.identity);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                    onLoadedData={() => {
                      if (import.meta.env.DEV && videoLogCountRef.current < 5) {
                        videoLogCountRef.current++;
                        console.log('ビデオ要素のデータ読み込み完了:', participant.identity);
                      }
                    }}
                    onError={(e) => {
                      console.error('ビデオ要素エラー:', e, participant.identity);
                    }}
                  />
                  
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                    {participant?.identity || 'Unknown'}
                    {isLocal && ' (あなた)'}
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
                                  ? 'bg-green-400 h-full' 
                                  : 'bg-yellow-400 h-full'
                                : 'bg-gray-600 h-1'
                            }`}
                          />
                        ))}
        </div>
                      
                      {/* 話している状態のインジケーター */}
                      {isSpeaking && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400 font-medium">話し中</span>
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