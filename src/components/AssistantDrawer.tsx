import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Mic, RotateCcw, Send, Square, X } from 'lucide-react';
import {
  sendAssistantMessageApi,
  transcribeAudioApi,
  type AssistantModelTier,
  type AssistantRolePreset,
  type SupportedTranscribeMimeType,
} from '../services/apiClient.ts';
import type { BusinessRecord, TaskItem } from '../types/busirx.ts';

interface AssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  business: BusinessRecord;
  tasks: TaskItem[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
}

const ROLE_OPTIONS: Array<{ value: AssistantRolePreset; label: string }> = [
  { value: 'advisor', label: 'Business Advisor' },
  { value: 'compliance', label: 'Compliance Reviewer' },
  { value: 'marketing', label: 'Marketing & Lead Coach' },
  { value: 'operations', label: 'Operations Manager' },
];

function normalizeRecorderMimeType(raw: string): SupportedTranscribeMimeType {
  const base = raw.split(';')[0].trim().toLowerCase();
  if (
    base === 'audio/webm' ||
    base === 'audio/mp4' ||
    base === 'audio/mpeg' ||
    base === 'audio/mp3' ||
    base === 'audio/wav' ||
    base === 'audio/ogg' ||
    base === 'audio/aac'
  ) {
    return base;
  }
  return 'audio/webm';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function AssistantDrawer({
  open,
  onClose,
  business,
  tasks,
}: AssistantDrawerProps) {
  const buildGreeting = (bizName: string): ChatMessage => ({
    role: 'assistant',
    content: `Hi! I'm your Busi Rx Advisor for ${bizName}. Choose a specialist role or ask about blueprint priorities, upcoming deadlines, social content, or leads.`,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([buildGreeting(business.name)]);
  const [rolePreset, setRolePreset] = useState<AssistantRolePreset>('advisor');
  const [modelTier, setModelTier] = useState<AssistantModelTier>('general');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const [recordingMic, setRecordingMic] = useState(false);
  const [transcribingMic, setTranscribingMic] = useState(false);
  const [micError, setMicError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([buildGreeting(business.name)]);
  }, [business.id, business.name]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Ignore recorder cleanup errors
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (!open) return null;

  const openTasks = tasks.filter((t) => t.status !== 'completed');
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueCount = openTasks.filter((t) => t.dueDate && t.dueDate < todayIso).length;

  const handleToggleMic = async () => {
    setMicError('');
    if (recordingMic) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        setRecordingMic(false);
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone capture is unavailable in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        setRecordingMic(false);
        const rawMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: rawMime });
        chunksRef.current = [];
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size === 0) return;

        setTranscribingMic(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const result = await transcribeAudioApi({
            audioBase64,
            mimeType: normalizeRecorderMimeType(rawMime),
            promptHint: `Business owner question for ${business.name} (${business.industry})`,
          });
          if (result.transcript) {
            setInput((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript));
          }
        } catch (err) {
          setMicError(err instanceof Error ? err.message : 'Unable to transcribe dictation.');
        } finally {
          setTranscribingMic(false);
        }
      };

      recorder.start();
      setRecordingMic(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone access was denied.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const historySnapshot = messages
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setMicError('');

    try {
      const resp = await sendAssistantMessageApi({
        message: trimmed,
        rolePreset,
        modelTier,
        history: historySnapshot,
        businessContext: {
          name: business.name,
          industry: business.industry,
          country: business.country,
          stateProvince: business.stateProvince,
          city: business.city,
          stage: business.stage,
          legalStructure: business.legalStructure,
          openTasksCount: openTasks.length,
          overdueCount,
          upcomingItems: openTasks.slice(0, 8).map((t) => `${t.title} (${t.dueDate || 'TBD'})`),
        },
      });
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: resp.reply, modelUsed: resp.modelUsed },
      ]);
    } catch (err) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'I could not reach the Busi Rx AI service right now. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
      <div className="w-full max-w-md bg-white h-full border-l border-[#E6E2F0] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E6E2F0] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-[#4C1D95] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-[#1C1B22] truncate">
                Busi Rx AI Assistant
              </h3>
              <p className="text-xs text-[#6E6A7C] truncate">{business.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMessages([buildGreeting(business.name)])}
              title="Reset conversation"
              aria-label="Reset conversation"
              className="p-1.5 text-[#6E6A7C] hover:text-[#1C1B22] rounded-lg"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="p-1.5 text-[#6E6A7C] hover:text-[#1C1B22] rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Role Preset & Model Selection Bar */}
        <div className="px-5 py-3 border-b border-[#E6E2F0] bg-[#FAF9FC] space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-[#6E6A7C] mb-1">
                Specialist Role
              </label>
              <select
                value={rolePreset}
                onChange={(e) => setRolePreset(e.target.value as AssistantRolePreset)}
                className="w-full text-xs font-medium text-[#1C1B22] bg-white border border-[#E6E2F0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#4C1D95]"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#6E6A7C] mb-1">
                Response Mode
              </label>
              <div className="grid grid-cols-2 gap-1 bg-white border border-[#E6E2F0] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setModelTier('general')}
                  className={`py-1 px-2 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    modelTier === 'general'
                      ? 'bg-[#4C1D95] text-white'
                      : 'text-[#4A4756] hover:bg-[#F3EFFC]'
                  }`}
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setModelTier('fast')}
                  className={`py-1 px-2 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    modelTier === 'fast'
                      ? 'bg-[#4C1D95] text-white'
                      : 'text-[#4A4756] hover:bg-[#F3EFFC]'
                  }`}
                >
                  Fast
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#6E6A7C]">
            Active: {modelTier === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen'} · Deep
            reasoning models (gemini-4-carbon / gemini-4-neon) require a paid API key.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F7FB]">
          {messages.map((m, idx) => (
            <div key={idx} className="space-y-1">
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-[#4C1D95] text-white'
                    : 'bg-white border border-[#E6E2F0] text-[#1C1B22]'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'assistant' && m.modelUsed && (
                <p className="text-[11px] text-[#6E6A7C] pl-1">{m.modelUsed}</p>
              )}
            </div>
          ))}
          {sending && (
            <div className="bg-white border border-[#E6E2F0] rounded-xl px-4 py-3 text-xs text-[#6E6A7C] inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4C1D95]" />
              Reviewing your business context...
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {micError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
            {micError}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-[#E6E2F0] bg-white flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={sending || transcribingMic}
            title={recordingMic ? 'Stop voice dictation' : 'Dictate question'}
            aria-label={recordingMic ? 'Stop voice dictation' : 'Dictate question'}
            className={`p-2.5 rounded-lg border transition-colors shrink-0 ${
              recordingMic
                ? 'bg-red-600 text-white border-red-600'
                : 'border-[#E6E2F0] text-[#4C1D95] hover:bg-[#F3EFFC]'
            } disabled:opacity-40`}
          >
            {transcribingMic ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recordingMic ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              recordingMic
                ? 'Listening... click stop when finished'
                : transcribingMic
                ? 'Transcribing voice note...'
                : 'Ask about licenses, next steps, or renewals...'
            }
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
          />
          <button
            type="submit"
            disabled={sending || transcribingMic || !input.trim()}
            aria-label="Send message"
            className="p-2.5 bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
