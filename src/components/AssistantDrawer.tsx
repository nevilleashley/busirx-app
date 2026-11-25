import React, { useState } from 'react';
import { Loader2, MessageSquare, Send, X } from 'lucide-react';
import { sendAssistantMessageApi } from '../services/apiClient.ts';
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
}

export function AssistantDrawer({
  open,
  onClose,
  business,
  tasks,
}: AssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your Busi Rx Advisor for ${business.name}. Ask me about prioritizing your blueprint, preparing for upcoming deadlines, or understanding what needs local confirmation.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const openTasks = tasks.filter((t) => t.status !== 'completed');
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueCount = openTasks.filter((t) => t.dueDate && t.dueDate < todayIso).length;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const nextHistory = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const resp = await sendAssistantMessageApi({
        message: trimmed,
        history: messages.slice(-10),
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
      setMessages([...nextHistory, { role: 'assistant', content: resp.reply }]);
    } catch (err) {
      setMessages([
        ...nextHistory,
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
        <div className="px-6 py-4 border-b border-[#E6E2F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#4C1D95]" />
            <div>
              <h3 className="font-display text-sm font-bold text-[#1C1B22]">
                Busi Rx AI Assistant
              </h3>
              <p className="text-xs text-[#6E6A7C]">{business.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="p-1.5 text-[#6E6A7C] hover:text-[#1C1B22] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F7FB]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'ml-auto bg-[#4C1D95] text-white'
                  : 'bg-white border border-[#E6E2F0] text-[#1C1B22]'
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="bg-white border border-[#E6E2F0] rounded-xl px-4 py-3 text-xs text-[#6E6A7C] inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4C1D95]" />
              Reviewing your business context...
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-[#E6E2F0] bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about licenses, next steps, or renewals..."
            className="flex-1 px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="p-2.5 bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
