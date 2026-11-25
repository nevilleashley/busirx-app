import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  FileAudio,
  Info,
  Loader2,
  Mic,
  PhoneCall,
  PhoneOff,
  Plus,
  Send,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  getLiveVoiceWebSocketUrl,
  transcribeAudioApi,
  type SupportedTranscribeMimeType,
} from '../services/apiClient.ts';
import type { BusinessRecord, LeadRecord } from '../types/busirx.ts';

interface VoiceStudioViewProps {
  business: BusinessRecord;
  leads: LeadRecord[];
  onCreateTaskFromTranscript: (params: {
    title: string;
    description: string;
  }) => Promise<void>;
  onAppendToLeadNote: (lead: LeadRecord, transcriptText: string) => Promise<void>;
}

type VoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';
type LiveRole = 'advisor' | 'sales' | 'operations';

interface TranscriptTurn {
  id: string;
  speaker: 'owner' | 'advisor' | 'system';
  text: string;
}

const VOICE_OPTIONS: Array<{ value: VoiceName; label: string }> = [
  { value: 'Zephyr', label: 'Zephyr (Bright)' },
  { value: 'Kore', label: 'Kore (Firm)' },
  { value: 'Puck', label: 'Puck (Upbeat)' },
  { value: 'Charon', label: 'Charon (Informative)' },
  { value: 'Fenrir', label: 'Fenrir (Direct)' },
];

const ROLE_OPTIONS: Array<{ value: LiveRole; label: string }> = [
  { value: 'advisor', label: 'Business Advisor' },
  { value: 'sales', label: 'Sales Call Practice' },
  { value: 'operations', label: 'Operations & Compliance' },
];

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function normalizeAudioMime(raw: string): SupportedTranscribeMimeType {
  const clean = raw.split(';')[0].trim().toLowerCase();
  if (
    clean === 'audio/webm' ||
    clean === 'audio/mp4' ||
    clean === 'audio/mpeg' ||
    clean === 'audio/mp3' ||
    clean === 'audio/wav' ||
    clean === 'audio/ogg' ||
    clean === 'audio/aac'
  ) {
    return clean;
  }
  if (clean === 'audio/x-wav' || clean === 'audio/wave') return 'audio/wav';
  if (clean === 'audio/x-m4a' || clean === 'audio/m4a') return 'audio/mp4';
  return 'audio/webm';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read audio bytes.'));
    reader.readAsDataURL(blob);
  });
}

export function VoiceStudioView({
  business,
  leads,
  onCreateTaskFromTranscript,
  onAppendToLeadNote,
}: VoiceStudioViewProps) {
  // Live Voice (gemini-3.8-live) state & refs
  const [voiceName, setVoiceName] = useState<VoiceName>('Zephyr');
  const [liveRole, setLiveRole] = useState<LiveRole>('advisor');
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [liveError, setLiveError] = useState('');
  const [liveTurns, setLiveTurns] = useState<TranscriptTurn[]>([]);
  const [liveTextInput, setLiveTextInput] = useState('');
  const [callSeconds, setCallSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isConnectedRef = useRef(false);
  const liveTranscriptEndRef = useRef<HTMLDivElement | null>(null);

  // Audio Transcription (gemini-3.5-transcribe) state & refs
  const [promptHint, setPromptHint] = useState('');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcriptModel, setTranscriptModel] = useState('');
  const [copied, setCopied] = useState(false);

  // Saving transcript into Firestore state
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [savingDestination, setSavingDestination] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  const transcribeRecorderRef = useRef<MediaRecorder | null>(null);
  const transcribeStreamRef = useRef<MediaStream | null>(null);
  const transcribeChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    liveTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTurns]);

  useEffect(() => {
    if (liveStatus !== 'connected') {
      setCallSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [liveStatus]);

  useEffect(() => {
    if (!recordingAudio) {
      setRecordSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [recordingAudio]);

  const clearQueuedPlayback = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (playbackCtxRef.current) {
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const stopLiveSession = () => {
    isConnectedRef.current = false;
    setLiveStatus('idle');

    clearQueuedPlayback();

    try {
      processorRef.current?.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    processorRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    if (captureCtxRef.current) {
      captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }

    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
      try {
        if (
          transcribeRecorderRef.current &&
          transcribeRecorderRef.current.state !== 'inactive'
        ) {
          transcribeRecorderRef.current.stop();
        }
      } catch {
        // Ignore
      }
      transcribeStreamRef.current?.getTracks().forEach((t) => t.stop());
      transcribeStreamRef.current = null;
    };
  }, []);

  const appendLiveTranscript = (speaker: TranscriptTurn['speaker'], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLiveTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && speaker !== 'system') {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: `${last.text} ${clean}`,
        };
        return updated;
      }
      return [...prev, { id: `${Date.now()}_${Math.random()}`, speaker, text: clean }];
    });
  };

  const playPcm24kChunk = (base64Pcm: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const pcm16 = base64ToInt16(base64Pcm);
    if (pcm16.length === 0) return;

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const handleStartLiveVoice = async () => {
    if (liveStatus !== 'idle') return;
    setLiveError('');
    setLiveTurns([]);
    setLiveStatus('connecting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setLiveError('Microphone capture is not supported in this browser.');
      setLiveStatus('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      const captureCtx = new AudioContext({ sampleRate: 16000 });
      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      captureCtxRef.current = captureCtx;
      playbackCtxRef.current = playbackCtx;
      nextStartTimeRef.current = playbackCtx.currentTime;

      const wsUrl = await getLiveVoiceWebSocketUrl({
        voiceName,
        role: liveRole,
        businessName: business.name,
        industry: business.industry,
      });

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: {
          type?: string;
          data?: string;
          text?: string;
          error?: string;
          model?: string;
        };
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }

        if (msg.type === 'ready') {
          isConnectedRef.current = true;
          setLiveStatus('connected');
          appendLiveTranscript(
            'system',
            `Connected (${voiceName} · ${msg.model || 'gemini-3.8-live'}). Speak naturally anytime.`
          );
          if (captureCtx.state === 'suspended') {
            captureCtx.resume().catch(() => {});
          }
          if (playbackCtx.state === 'suspended') {
            playbackCtx.resume().catch(() => {});
          }
        } else if (msg.type === 'audio' && msg.data) {
          playPcm24kChunk(msg.data);
        } else if (msg.type === 'inputTranscript' && msg.text) {
          appendLiveTranscript('owner', msg.text);
        } else if (msg.type === 'outputTranscript' && msg.text) {
          appendLiveTranscript('advisor', msg.text);
        } else if (msg.type === 'interrupted') {
          clearQueuedPlayback();
        } else if (msg.type === 'error') {
          setLiveError(msg.error || 'Live voice connection encountered an error.');
          stopLiveSession();
        }
      };

      ws.onerror = () => {
        setLiveError('Live voice WebSocket connection failed.');
        stopLiveSession();
      };

      ws.onclose = () => {
        if (isConnectedRef.current) {
          appendLiveTranscript('system', 'Voice session ended.');
        }
        stopLiveSession();
      };

      const sourceNode = captureCtx.createMediaStreamSource(stream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isConnectedRef.current) return;
        const activeWs = wsRef.current;
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        activeWs.send(JSON.stringify({ audio: int16ToBase64(pcm16) }));
      };

      sourceNode.connect(processor);
      // Connect through a muted gain node to satisfy Chrome WebAudio graph without mic echo
      const silentGain = captureCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(captureCtx.destination);
    } catch (err) {
      setLiveError(
        err instanceof Error ? err.message : 'Unable to initialize live voice session.'
      );
      stopLiveSession();
    }
  };

  const handleSendLiveText = (e: React.FormEvent) => {
    e.preventDefault();
    const text = liveTextInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    appendLiveTranscript('owner', text);
    setLiveTextInput('');
  };

  const runTranscriptionBlob = async (blob: Blob, rawMimeType: string) => {
    if (blob.size > 10 * 1024 * 1024) {
      setTranscribeError('Audio file is too large (max 10 MB).');
      return;
    }
    setTranscribeError('');
    setSaveFeedback('');
    setTranscribing(true);

    try {
      const audioBase64 = await blobToBase64(blob);
      const result = await transcribeAudioApi({
        audioBase64,
        mimeType: normalizeAudioMime(rawMimeType),
        promptHint:
          promptHint.trim() || `${business.name} (${business.industry}) business voice note`,
      });
      setTranscript(result.transcript);
      setTranscriptModel(result.model);
      if (!taskTitle.trim() && result.transcript) {
        const firstLine = result.transcript.split(/[.!?\n]/)[0].trim().slice(0, 80);
        setTaskTitle(firstLine || 'Follow up on transcribed audio note');
      }
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Unable to transcribe audio.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleToggleRecording = async () => {
    setTranscribeError('');
    if (recordingAudio) {
      try {
        transcribeRecorderRef.current?.stop();
      } catch {
        setRecordingAudio(false);
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setTranscribeError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      transcribeStreamRef.current = stream;
      transcribeChunksRef.current = [];
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosen = preferred.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = chosen
        ? new MediaRecorder(stream, { mimeType: chosen })
        : new MediaRecorder(stream);
      transcribeRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          transcribeChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        setRecordingAudio(false);
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(transcribeChunksRef.current, { type: mime });
        transcribeChunksRef.current = [];
        stream.getTracks().forEach((t) => t.stop());
        transcribeStreamRef.current = null;
        if (blob.size > 0) {
          await runTranscriptionBlob(blob, mime);
        }
      };

      recorder.start();
      setRecordingAudio(true);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Microphone access denied.');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runTranscriptionBlob(file, file.type || 'audio/mp3');
  };

  const handleCopyTranscript = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleSaveAsTask = async () => {
    if (!transcript.trim() || savingDestination) return;
    setSavingDestination(true);
    setSaveFeedback('');
    setTranscribeError('');
    try {
      await onCreateTaskFromTranscript({
        title: taskTitle.trim() || 'Follow up on voice note',
        description: transcript.trim(),
      });
      setSaveFeedback('Saved transcript as an actionable task in Tasks & Reminders.');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Unable to create task.');
    } finally {
      setSavingDestination(false);
    }
  };

  const handleAppendToLead = async () => {
    if (!transcript.trim() || !selectedLeadId || savingDestination) return;
    const target = leads.find((l) => l.id === selectedLeadId);
    if (!target) return;

    setSavingDestination(true);
    setSaveFeedback('');
    setTranscribeError('');
    try {
      await onAppendToLeadNote(target, transcript.trim());
      setSaveFeedback(`Appended transcript to Lead CRM notes for ${target.fullName}.`);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Unable to update lead note.');
    } finally {
      setSavingDestination(false);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Voice Advisor &amp; Audio Studio
          </h2>
          <p className="text-xs text-[#6E6A7C]">
            Real-time two-way voice coaching and audio note transcription saved to {business.name}.
          </p>
        </div>
      </div>

      {/* Main 2-column studio: Live Voice + Audio Transcription */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-time Voice Conversation (gemini-3.8-live) */}
        <section className="lg:col-span-6 bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Volume2 className="w-5 h-5 text-[#4C1D95] mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                    Real-Time Voice Advisor
                  </h3>
                  <p className="text-xs text-[#6E6A7C]">
                    Bidirectional 16kHz/24kHz audio · gemini-3.8-live
                  </p>
                </div>
              </div>
              {liveStatus === 'connected' && (
                <span className="font-mono-tabular text-xs font-semibold text-[#059669] shrink-0">
                  Live · {formatDuration(callSeconds)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">
                  Advisor Voice
                </label>
                <select
                  value={voiceName}
                  disabled={liveStatus !== 'idle'}
                  onChange={(e) => setVoiceName(e.target.value as VoiceName)}
                  className="w-full text-xs font-medium text-[#1C1B22] bg-[#FAF9FC] border border-[#E6E2F0] rounded-lg px-3 py-2 disabled:opacity-60"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">
                  Session Focus
                </label>
                <select
                  value={liveRole}
                  disabled={liveStatus !== 'idle'}
                  onChange={(e) => setLiveRole(e.target.value as LiveRole)}
                  className="w-full text-xs font-medium text-[#1C1B22] bg-[#FAF9FC] border border-[#E6E2F0] rounded-lg px-3 py-2 disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {liveStatus === 'idle' ? (
                <button
                  type="button"
                  onClick={handleStartLiveVoice}
                  className="px-4 py-2.5 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <PhoneCall className="w-4 h-4" />
                  Start Live Voice Call
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveSession}
                  className="px-4 py-2.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  {liveStatus === 'connecting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneOff className="w-4 h-4" />
                  )}
                  {liveStatus === 'connecting' ? 'Connecting...' : 'End Voice Call'}
                </button>
              )}
            </div>

            {liveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {liveError}
              </div>
            )}

            {/* Live Transcript Feed */}
            <div className="border border-[#E6E2F0] rounded-lg bg-[#F8F7FB] h-64 overflow-y-auto p-4 space-y-3">
              {liveTurns.length === 0 ? (
                <p className="text-xs text-[#6E6A7C] leading-relaxed">
                  Start a live call to talk through sales objections, licensing checklists, or daily
                  priorities hands-free. Interrupt naturally at any moment.
                </p>
              ) : (
                liveTurns.map((t) => (
                  <div
                    key={t.id}
                    className={`text-xs leading-relaxed ${
                      t.speaker === 'system'
                        ? 'text-[#6E6A7C] italic'
                        : t.speaker === 'owner'
                        ? 'text-[#1C1B22]'
                        : 'text-[#4C1D95]'
                    }`}
                  >
                    {t.speaker !== 'system' && (
                      <span className="font-semibold mr-1.5">
                        {t.speaker === 'owner' ? 'You:' : 'Busi Rx:'}
                      </span>
                    )}
                    <span>{t.text}</span>
                  </div>
                ))
              )}
              <div ref={liveTranscriptEndRef} />
            </div>
          </div>

          <form onSubmit={handleSendLiveText} className="flex items-center gap-2">
            <input
              type="text"
              value={liveTextInput}
              disabled={liveStatus !== 'connected'}
              onChange={(e) => setLiveTextInput(e.target.value)}
              placeholder={
                liveStatus === 'connected'
                  ? 'Type a follow-up prompt into the live voice session...'
                  : 'Connect voice call to send live text prompts'
              }
              className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95] disabled:bg-[#FAF9FC]"
            />
            <button
              type="submit"
              disabled={liveStatus !== 'connected' || !liveTextInput.trim()}
              aria-label="Send text to live voice session"
              className="p-2 bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

        {/* Right: Audio Transcription & Save to Firestore (gemini-3.5-transcribe) */}
        <section className="lg:col-span-6 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-5">
          <div className="flex items-start gap-2.5">
            <FileAudio className="w-5 h-5 text-[#059669] mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                Transcribe Audio &amp; Save to Workspace
              </h3>
              <p className="text-xs text-[#6E6A7C]">
                Record client calls/memos or upload audio files · gemini-3.5-transcribe
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">
              Optional Context Hint (helps spelling of names or terms)
            </label>
            <input
              type="text"
              value={promptHint}
              onChange={(e) => setPromptHint(e.target.value)}
              placeholder={`e.g. Discovery call with buyer about ${business.activity}`}
              className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={transcribing}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap ${
                recordingAudio
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-[#059669] text-white hover:bg-[#047857]'
              } disabled:opacity-50`}
            >
              {recordingAudio ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Stop Recording · {formatDuration(recordSeconds)}
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Record Voice Memo
                </>
              )}
            </button>

            <label className="px-4 py-2.5 text-xs font-semibold border border-[#E6E2F0] text-[#1C1B22] rounded-lg hover:bg-[#FAF9FC] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-[#4C1D95]" />
              Upload Audio File
              <input
                type="file"
                accept="audio/*"
                disabled={recordingAudio || transcribing}
                onChange={handleUploadFile}
                className="hidden"
              />
            </label>
          </div>

          {transcribing && (
            <div className="p-3 rounded-lg bg-[#F3EFFC] text-xs text-[#4C1D95] inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Transcribing audio with Gemini...
            </div>
          )}

          {transcribeError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {transcribeError}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#4A4756]">
                Transcript {transcriptModel ? `· ${transcriptModel}` : ''}
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  className="text-xs font-medium text-[#4C1D95] hover:underline inline-flex items-center gap-1"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  {copied ? 'Copied' : 'Copy text'}
                </button>
              )}
            </div>
            <textarea
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your transcribed memo or call notes will appear here. Edit freely before saving to Tasks or Lead CRM."
              className="w-full p-3 text-xs leading-relaxed border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
            />
          </div>

          {/* Save Transcript to Firestore Tasks or Lead CRM */}
          <div className="pt-2 border-t border-[#F1EEF7] space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title (for Tasks & Reminders)"
                className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
              />
              <button
                type="button"
                onClick={handleSaveAsTask}
                disabled={!transcript.trim() || savingDestination}
                className="px-3.5 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Save as Task
              </button>
            </div>

            {leads.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white focus:outline-none focus:border-[#4C1D95]"
                >
                  <option value="">Select a Lead CRM contact to attach note...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName} ({l.stage})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAppendToLead}
                  disabled={!transcript.trim() || !selectedLeadId || savingDestination}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#ECFDF5] text-[#065F46] rounded-lg hover:bg-[#D1FAE5] disabled:opacity-40 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  Attach to Lead Notes
                </button>
              </div>
            )}

            {saveFeedback && (
              <p className="text-xs text-[#059669] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {saveFeedback}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Honest Notice on Paid-Key Capabilities */}
      <div className="bg-[#FAF9FC] border border-[#E6E2F0] rounded-xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#4C1D95] mt-0.5 shrink-0" />
        <div className="text-xs text-[#4A4756] space-y-1">
          <p className="font-semibold text-[#1C1B22]">
            Paid Gemini API Key Required for Image &amp; Video Studio
          </p>
          <p>
            Image creation &amp; editing (gemini-nano-banana-2.1), text-to-video &amp; image
            animation (gemini-omni-1.2-flash), and high-reasoning chatbot models (gemini-4-carbon /
            gemini-4-neon) require selecting a paid Gemini API key in AI Studio and were not enabled
            because paid key setup was declined.
          </p>
        </div>
      </div>
    </div>
  );
}
