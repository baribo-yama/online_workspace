/**
 * VideoCallRoom コンポーネント
 * 
 * LiveKitを使用したリアルタイムビデオ通話機能を提供するコンポーネント
 * 
 * 主な機能:
 * - リアルタイムビデオ・音声通話
 * - カメラ・マイクのオン/オフ制御
 * - 音声レベル監視とスピーキングインジケーター
 * - 参加者の動的な追加・削除
 * - 自動再接続機能
 * 
 * @param {string} roomId - ルームID
 * @param {string} userName - ユーザー名
 * @param {function} onRoomDisconnected - ルーム切断時のコールバック
 * @param {function} onLeaveRoom - ルーム退出時のコールバック
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


const TRACK_ATTACHMENT_DELAY = 100; // トラックアタッチ時の遅延時間（ms）
function VideoCallRoom({ roomId, userName, onRoomDisconnected, onLeaveRoom }) {
  // === 状態管理 ===
  const [participants, setParticipants] = useState([]);           // リモート参加者リスト
  const [localParticipant, setLocalParticipant] = useState(null); // ローカル参加者情報
  const [isConnecting, setIsConnecting] = useState(false);        // 接続中フラグ
  const [error, setError] = useState(null);                      // エラー状態
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);    // ビデオ有効状態
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);    // オーディオ有効状態
  const [audioLevel, setAudioLevel] = useState(0);               // 音声レベル
  const [isSpeaking, setIsSpeaking] = useState(false);           // スピーキング状態
  
  // === 参照管理 ===
  const roomRef = useRef(null);                                    // LiveKitルームインスタンス
  const hasConnectedRef = useRef(false);                          // 接続済みフラグ
  const isConnectingRef = useRef(false);                          // 接続中フラグ（重複接続防止）
  const connectToRoomRef = useRef(null);                          // 接続関数の参照
  const audioContextRef = useRef(null);                           // 音声コンテキスト
  const analyserRef = useRef(null);                               // 音声分析器
  const animationFrameRef = useRef(null);                         // アニメーションフレームID
  const startAudioLevelMonitoringRef = useRef(null);              // 音声レベル監視開始関数
  const startAudioLevelMonitoringWithTrackRef = useRef(null);     // トラック付き音声レベル監視
  const audioMonitoringRetryCountRef = useRef(0);                 // 音声監視リトライ回数
  const roomIdRef = useRef(roomId);                               // ルームID（最新値保持）
  const userNameRef = useRef(userName);                           // ユーザー名（最新値保持）
  const updateParticipantsLogCountRef = useRef(0);                // 参加者更新ログカウンター
  const cameraMicLogCountRef = useRef(0);                         // カメラ・マイクログカウンター
  const audioElementsRef = useRef(new Map());                     // リモート参加者の音声要素の参照管理

  /**
   * 参加者リストを更新する関数
   * ローカル参加者とリモート参加者を統合して状態を更新
   */
  const updateParticipants = useCallback(() => {
    if (!roomRef.current) return;

    const allParticipants = [
      roomRef.current.localParticipant,
      ...Array.from(roomRef.current.remoteParticipants.values())
    ].filter(p => p);

    // 参加者リストが変更された場合のみ更新
    setParticipants(prevParticipants => {
      // 参加者数が変更された場合
      if (prevParticipants.length !== allParticipants.length) {
        if (import.meta.env.DEV && updateParticipantsLogCountRef.current < 10) {
          updateParticipantsLogCountRef.current++;
          console.log('参加者リスト更新:', allParticipants.length, '人', 
            allParticipants.map(p => ({ identity: p.identity, isLocal: p === roomRef.current.localParticipant })));
        }
        return allParticipants;
      }
      
      // 参加者のIDが変更された場合
      const prevIds = prevParticipants.map(p => p.identity).sort();
      const newIds = allParticipants.map(p => p.identity).sort();
      if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
        if (import.meta.env.DEV && updateParticipantsLogCountRef.current < 10) {
          updateParticipantsLogCountRef.current++;
          console.log('参加者ID変更検出 - リスト更新');
        }
        return allParticipants;
      }
      
      return prevParticipants;
    });
    
    setLocalParticipant(roomRef.current.localParticipant);
  }, []);

  /**
   * リモート参加者の音声トラックを音声要素にアタッチして再生する
   * 
   * この関数は、LiveKitから受信したリモート参加者の音声トラックを
   * HTMLのaudio要素に接続し、自動的に再生を開始します。
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
        // 既存の要素の音声ストリームを更新（リソースリークを防ぐ）
        const currentStream = existingElement.srcObject;
        if (currentStream && currentStream.getTracks().length > 0) {
          // 既存のトラックを停止してリソースを解放
          currentStream.getTracks().forEach(track => track.stop());
        }
        existingElement.srcObject = new MediaStream([track.mediaStreamTrack]);
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
      audioElement.srcObject = new MediaStream([track.mediaStreamTrack]); // 音声ストリームを設定
      
      // 音声要素をDOMに追加（非表示で管理）
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      // 参加者IDをキーとして音声要素の参照を保存
      audioElementsRef.current.set(participant.identity, audioElement);

      // 音声の再生を開始
      audioElement.play().catch(error => {
        console.warn('音声再生エラー:', error);
        // ブラウザの自動再生制限への対応
        if (error.name === 'NotAllowedError') {
          console.log('音声再生にはユーザーインタラクションが必要です');
          // AbortControllerを使用してイベントリスナーを管理
          const abortController = new AbortController();
          const handleUserInteraction = () => {
            audioElement.play().catch(e => console.warn('再試行でも音声再生失敗:', e));
            abortController.abort(); // イベントリスナーを削除
          };
          
          // スコープを限定したイベントリスナー（AbortController付き）
          document.addEventListener('click', handleUserInteraction, { 
            signal: abortController.signal,
            once: true 
          });
          document.addEventListener('touchstart', handleUserInteraction, { 
            signal: abortController.signal,
            once: true 
          });
        }
      });

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
  }, []);

  /**
   * 指定された参加者の音声要素をクリーンアップする
   * 
   * 参加者が退出した際や、音声トラックが非購読された際に
   * 音声要素を適切に削除してメモリリークを防ぎます。
   * 
   * @param {string} participantIdentity - 参加者のID
   */
  const cleanupAudioElement = useCallback((participantIdentity) => {
    const audioElement = audioElementsRef.current.get(participantIdentity);
    if (audioElement) {
      // 音声の再生を停止
      audioElement.pause();
      // 音声ストリームをクリア
      audioElement.srcObject = null;
      // DOMから音声要素を削除
      if (audioElement.parentNode) {
        audioElement.parentNode.removeChild(audioElement);
      }
      // 参照マップから削除
      audioElementsRef.current.delete(participantIdentity);
      
      if (import.meta.env.DEV) {
        console.log('音声要素をクリーンアップ:', participantIdentity);
      }
    }
  }, []);

  // カメラとマイクを有効化
  const enableCameraAndMicrophone = useCallback(async () => {
    if (!roomRef.current) return;

    try {
        if (import.meta.env.DEV && cameraMicLogCountRef.current < 10) {
          cameraMicLogCountRef.current++;
          console.log('カメラ・マイクアクセス開始');
        }
      
      // カメラとマイクを個別に有効化
      try {
        if (import.meta.env.DEV && cameraMicLogCountRef.current < 10) {
          cameraMicLogCountRef.current++;
          console.log('カメラを有効化中...', {
            hasLocalParticipant: !!roomRef.current.localParticipant,
            currentCameraState: roomRef.current.localParticipant?.isCameraEnabled
          });
        }
        await roomRef.current.localParticipant.setCameraEnabled(true);
        if (import.meta.env.DEV && cameraMicLogCountRef.current < 10) {
          cameraMicLogCountRef.current++;
          console.log('カメラ有効化成功', {
            newCameraState: roomRef.current.localParticipant.isCameraEnabled,
            hasVideoTracks: roomRef.current.localParticipant.videoTracks?.size > 0
          });
        }
      } catch (cameraError) {
        console.warn('カメラ有効化エラー:', cameraError);
      }

      try {
        if (import.meta.env.DEV) {
          console.log('マイクを有効化中...', {
            hasLocalParticipant: !!roomRef.current.localParticipant,
            currentMicrophoneState: roomRef.current.localParticipant?.isMicrophoneEnabled
          });
        }
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
        if (import.meta.env.DEV) {
          console.log('マイク有効化成功', {
            newMicrophoneState: roomRef.current.localParticipant.isMicrophoneEnabled,
            hasAudioTracks: roomRef.current.localParticipant.audioTracks?.size > 0
          });
        }
      } catch (microphoneError) {
        console.warn('マイク有効化エラー:', microphoneError);
      }
      
        if (import.meta.env.DEV) {
        console.log('カメラ・マイクアクセス成功');
        }

      // LocalTrackPublishedイベントでトラックがアタッチされるまで短時間待機
      // videoTracksコレクションの更新を待つのではなく、イベントベースで処理
      if (import.meta.env.DEV) {
        console.log('LocalTrackPublishedイベントを待機中...');
      }
      
      // 参加者リストを更新（LocalTrackPublishedイベントでトラックがアタッチされる）
          setTimeout(() => {
              updateParticipants();
            }, 1000);
      
      // 音声レベル監視はLocalTrackPublishedイベントで自動的に開始される
      
      } catch (mediaError) {
      console.error('カメラ・マイクアクセスエラー:', mediaError);
        
      // 無音検出の場合は警告として扱う
        if (mediaError.message && mediaError.message.includes('silence detected')) {
          console.log('音声トラックで無音が検出されました（正常な動作）');
          updateParticipants();
          return;
        }
        
      setError(`メディアアクセスエラー: ${mediaError.message}`);
    }
  }, [updateParticipants]);

  // 音声レベル監視を開始（トラックを直接受け取る）
  const startAudioLevelMonitoringWithTrack = useCallback((audioTrack) => {
    if (!audioTrack || !audioTrack.mediaStreamTrack) {
      console.log('音声レベル監視: 有効なオーディオトラックが提供されていません');
      return;
    }

    try {
      // AudioContextを作成
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(
        new MediaStream([audioTrack.mediaStreamTrack])
      );
      source.connect(analyserRef.current);

      // 音声レベルを監視
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // 音声レベルを計算（0-100の範囲）
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const level = Math.min(100, (average / 255) * 100);
        
        setAudioLevel(level);
        
        // 話しているかどうかを判定（閾値: 10）
        const speaking = level > 10;
        setIsSpeaking(speaking);

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      if (import.meta.env.DEV) {
      console.log('音声レベル監視を開始（トラック直接使用）');
    }
      
      // 成功したら再試行カウンターをリセット
      audioMonitoringRetryCountRef.current = 0;
    } catch (error) {
      console.error('音声レベル監視エラー:', error);
    }
  }, []);

  // 音声レベル監視を開始（従来の方法）
  const startAudioLevelMonitoring = useCallback(() => {
    if (!roomRef.current || !roomRef.current.localParticipant) {
      console.log('音声レベル監視: ルームまたはローカル参加者が利用できません');
            return;
          }

    try {
      // オーディオトラックが利用可能かチェック
      const localParticipant = roomRef.current.localParticipant;
      console.log('音声レベル監視: ローカル参加者情報:', {
        hasAudioTracks: !!localParticipant.audioTracks,
        audioTracksType: typeof localParticipant.audioTracks,
        audioTracksSize: localParticipant.audioTracks?.size || 0,
        hasValuesMethod: typeof localParticipant.audioTracks?.values === 'function'
      });
      
      if (!localParticipant.audioTracks || typeof localParticipant.audioTracks.values !== 'function') {
        console.log('音声レベル監視: audioTracksが利用できません - LocalTrackPublishedイベントを待機');
      return;
      }

      // ローカル参加者のオーディオトラックを取得
      const audioTracks = Array.from(localParticipant.audioTracks.values());
      console.log('音声レベル監視: オーディオトラック一覧:', audioTracks.map(track => ({
        source: track.source,
        kind: track.kind,
        hasMediaStreamTrack: !!track.mediaStreamTrack,
        isEnabled: track.isEnabled
      })));
      
      const audioTrack = audioTracks.find(track => track.source === Track.Source.Microphone);
      console.log('音声レベル監視: マイクトラック:', audioTrack ? {
        source: audioTrack.source,
        hasMediaStreamTrack: !!audioTrack.mediaStreamTrack,
        isEnabled: audioTrack.isEnabled
      } : '見つかりません');
      
      if (audioTrack && audioTrack.mediaStreamTrack) {
        startAudioLevelMonitoringWithTrack(audioTrack);
      } else {
        console.log('音声レベル監視: マイクトラックが見つかりません - 再試行をスケジュール');
        
        // 再試行回数をチェック（最大3回）
        if (audioMonitoringRetryCountRef.current < 3) {
          audioMonitoringRetryCountRef.current++;
          // 3秒後に再試行
        setTimeout(() => {
            if (startAudioLevelMonitoringRef.current) {
              startAudioLevelMonitoringRef.current();
            }
          }, 3000);
      } else {
          console.log('音声レベル監視: 最大再試行回数に達しました');
        }
      }
    } catch (error) {
      console.error('音声レベル監視エラー:', error);
      
      // 再試行回数をチェック（最大3回）
      if (audioMonitoringRetryCountRef.current < 3) {
        audioMonitoringRetryCountRef.current++;
        // エラーが発生した場合は5秒後に再試行
        setTimeout(() => {
          if (startAudioLevelMonitoringRef.current) {
            startAudioLevelMonitoringRef.current();
          }
        }, 5000);
      } else {
        console.log('音声レベル監視: 最大再試行回数に達しました');
      }
    }
  }, [startAudioLevelMonitoringWithTrack]);

  // 音声レベル監視を停止
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
    setIsSpeaking(false);
      if (import.meta.env.DEV) {
        console.log('音声レベル監視を停止');
      }
  }, []);

  // roomIdとuserNameの参照を更新
  useEffect(() => {
    roomIdRef.current = roomId;
    userNameRef.current = userName;
  }, [roomId, userName]);

  // startAudioLevelMonitoring関数の参照を設定
  useEffect(() => {
    startAudioLevelMonitoringRef.current = startAudioLevelMonitoring;
    startAudioLevelMonitoringWithTrackRef.current = startAudioLevelMonitoringWithTrack;
  }, [startAudioLevelMonitoring, startAudioLevelMonitoringWithTrack]);

  // ルームに接続
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
        // 参加者が接続された時
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('参加者が接続されました:', participant.identity);
          }
          updateParticipants();
        });

        // 参加者が切断された時
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('参加者が切断されました:', participant.identity);
          }
          updateParticipants();
        });

        // トラックが購読された時
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('トラックが購読されました:', track.kind, participant.identity);
          updateParticipants();
        });

        // トラックが購読解除された時
        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log('トラックが購読解除されました:', track.kind, participant.identity);
      updateParticipants();
        });

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
              }, 500);
          }
        });

        // ローカルトラックが非公開になった時
        room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
          console.log('ローカルトラック非公開:', publication.kind, participant.identity);
        updateParticipants();
        });

        // リモート参加者が参加した時
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('リモート参加者が参加:', participant.identity);
          }
          updateParticipants();
        });

        // リモート参加者が退出した時
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (import.meta.env.DEV) {
            console.log('リモート参加者が退出:', participant.identity);
          }
          // 退出した参加者の音声要素をクリーンアップ（メモリリーク防止）
          cleanupAudioElement(participant.identity);
          updateParticipants();
        });

        // リモートトラックが購読された時（音声・ビデオの受信開始）
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (import.meta.env.DEV) {
            console.log('リモートトラック購読:', track.kind, participant.identity);
          }
          
          if (track.kind === Track.Kind.Video) {
            // ビデオトラックの処理は既存のattachVideoTrackで行う
            setTimeout(() => {
              updateParticipants();
            }, TRACK_ATTACHMENT_DELAY);
          } else if (track.kind === Track.Kind.Audio) {
            // オーディオトラックの処理
            if (import.meta.env.DEV) {
              console.log('connectToRoom内でオーディオトラック購読完了:', participant.identity);
            }
            // リモート参加者の音声トラックを自動的に再生開始
            attachAudioTrack(track, participant);
            setTimeout(() => {
              updateParticipants();
            }, TRACK_ATTACHMENT_DELAY);
          }
        });

        // リモートトラックが非購読された時（音声・ビデオの受信停止）
        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (import.meta.env.DEV) {
            console.log('リモートトラック非購読:', track.kind, participant.identity);
          }
          
          if (track.kind === Track.Kind.Audio) {
            // 音声トラックが非購読された際に音声要素をクリーンアップ
            cleanupAudioElement(participant.identity);
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

  // connectToRoomの参照を設定
  useEffect(() => {
    connectToRoomRef.current = connectToRoom;
  }, [connectToRoom]);

  // ルームから切断
  const disconnectFromRoom = useCallback(async () => {
    try {
      // 全てのリモート参加者の音声要素をクリーンアップ（メモリリーク防止）
      // Array.from()でスナップショットを作成してMap変更時の問題を回避
      const participantIdentities = Array.from(audioElementsRef.current.keys());
      participantIdentities.forEach(participantIdentity => {
        cleanupAudioElement(participantIdentity);
      });

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

  // ビデオの切り替え
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

  // オーディオの切り替え
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

    // コンポーネントマウント時に接続
    useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('VideoCallRoom マウント - 接続開始', { roomId, userName });
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
  }, [roomId, userName, stopAudioLevelMonitoring]); // roomIdとuserNameを依存配列に追加

  // シンプルなビデオ表示用のref
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const videoLogCountRef = useRef(0);

  // ビデオトラックをアタッチする関数
  const attachVideoTrack = useCallback((track, participant, isLocal) => {
    if (!track) {
      console.log('トラックが存在しません:', participant.identity);
      return;
    }

    const videoElement = isLocal ? localVideoRef.current : remoteVideoRefs.current.get(participant.identity);
    if (!videoElement) {
      console.log('ビデオ要素が存在しません:', participant.identity, isLocal ? '(ローカル)' : '(リモート)');
      return;
    }

    try {
      // 既存のトラックをデタッチ
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      
      track.attach(videoElement);
      
      if (import.meta.env.DEV && videoLogCountRef.current < 5) {
        videoLogCountRef.current++;
        console.log('ビデオトラックアタッチ成功:', participant.identity, isLocal ? '(ローカル)' : '(リモート)');
      }
    } catch (error) {
      console.error('ビデオトラックアタッチエラー:', error, participant.identity);
    }
  }, []);

  // リモートビデオトラックのイベント処理
  useEffect(() => {
    if (!roomRef.current) return;

    const handleTrackSubscribed = (track, publication, participant) => {
      if (publication.kind === 'video' && track) {
        if (import.meta.env.DEV && videoLogCountRef.current < 5) {
          videoLogCountRef.current++;
          console.log('TrackSubscribedイベントでvideoトラックを検出:', track);
        }
        // ビデオトラックを少し遅延させてからアタッチ
        setTimeout(() => {
          attachVideoTrack(track, participant, false);
        }, TRACK_ATTACHMENT_DELAY);
      } else if (publication.kind === 'audio' && track) {
        if (import.meta.env.DEV) {
          console.log('TrackSubscribedイベントでaudioトラックを検出:', track, {
            participantIdentity: participant.identity,
            hasMediaStreamTrack: !!track.mediaStreamTrack,
            trackKind: track.kind
          });
        }
        // リモート参加者の音声トラックを自動的に再生開始
        setTimeout(() => {
          console.log('音声トラックアタッチを実行:', participant.identity);
          attachAudioTrack(track, participant);
        }, TRACK_ATTACHMENT_DELAY);
      }
    };

    roomRef.current.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      if (roomRef.current) {
        roomRef.current.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      }
    };
  }, [attachVideoTrack, attachAudioTrack]);

  // ローカルビデオトラックの処理
  useEffect(() => {
    if (!localParticipant || !localVideoRef.current) return;

    // 既存のビデオトラックをチェック
    if (localParticipant.videoTrackPublications) {
      for (const publication of localParticipant.videoTrackPublications.values()) {
        if (publication.track) {
          console.log('既存のローカルビデオトラックをアタッチ:', publication.track);
          attachVideoTrack(publication.track, localParticipant, true);
          break;
        }
      }
    }
  }, [localParticipant, attachVideoTrack]);

  // ローカルトラック公開イベントの処理
  useEffect(() => {
    if (!roomRef.current || !localParticipant) return;

    const handleLocalTrackPublished = (publication, participant) => {
      if (publication.kind === 'video' && publication.track && participant.identity === localParticipant.identity) {
        console.log('ローカルビデオトラック公開イベント受信:', publication.track);
        setTimeout(() => {
          attachVideoTrack(publication.track, participant, true);
        }, 100);
      }
    };

    roomRef.current.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);

    return () => {
      if (roomRef.current) {
        roomRef.current.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      }
    };
  }, [localParticipant, attachVideoTrack]);

  // リモートビデオトラックの処理
  useEffect(() => {
    if (!participants.length) return;

    participants.forEach(participant => {
      if (participant === localParticipant) return; // ローカル参加者はスキップ

      // 既存のビデオトラックをチェック
      if (participant.videoTrackPublications) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track) {
            attachVideoTrack(publication.track, participant, false);
            break;
          }
        }
      }
    });
  }, [participants, localParticipant, attachVideoTrack]);

  // ローディング画面
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

  // エラー画面
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

  // メイン画面
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

// メモ化してパフォーマンスを最適化
export default memo(VideoCallRoom, (prevProps, nextProps) => {
    return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.userName === nextProps.userName
  );
});