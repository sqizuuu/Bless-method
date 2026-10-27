import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { getStoredToken } from '../api.js';
import {
  Sparkles,
  Send,
  HelpCircle,
  AlertCircle,
  Cpu,
  Coins,
  Video,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  source?: string;
}

interface HelpAIPageProps {
  onOpenOptimizer: () => void;
  onOpenShop: () => void;
  onOpenPoints: () => void;
  onOpenSettings: () => void;
}

const PRESET_QUESTIONS = [
  {
    icon: Video,
    title: 'Why is my TikTok upload blurry?',
    prompt: 'Why does TikTok make my video blurry and compress it down to 720p, and how do I prevent this using BLESS METHOD?',
  },
  {
    icon: Coins,
    title: '0 Points lockout help',
    prompt: 'I have 0 points and the optimizer says I cannot optimize without points. How do I get more points or claim my free weekly points?',
  },
  {
    icon: AlertCircle,
    title: 'Encoding failed or error',
    prompt: 'What happens if a video encoding job fails or gets stuck? Do I lose my points, and what file types work best?',
  },
  {
    icon: Cpu,
    title: 'HandBrake vs Stream Copy',
    prompt: 'What is the difference between HandBrake re-encoding (High/Med/Low) and FFmpeg Stream Copy, and when should I use each?',
  },
];

export const HelpAIPage: React.FC<HelpAIPageProps> = ({
  onOpenOptimizer,
  onOpenShop,
  onOpenPoints,
  onOpenSettings,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `### Welcome to BLESS AI Support
**"USE THE QUALITY YOU FILMED."**

I am your technical specialist for video encoding, bitrate tuning, points rules, and TikTok upload specifications. 

If you are experiencing:
- **0 Points lockout** or need points refilled
- **Blurry or pixelated TikTok uploads**
- **HandBrake / FFmpeg encoding errors or audio desync**
- **Questions on Google / Discord sign-in**

Ask me anything below or select one of the suggested troubleshooting topics!`,
      timestamp: Date.now(),
      source: 'BLESS AI Specialist',
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputValue).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputValue('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const token = getStoredToken();
      const response = await fetch('/api/ai/help', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: textToSend,
          history,
          userContext: {
            pointsBalance: user?.pointsBalance ?? 0,
            isAuthenticated: Boolean(user),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error while generating help response');
      }

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Here is the technical guidance you requested.',
        timestamp: data.timestamp || Date.now(),
        source: data.source || 'BLESS AI',
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: `### Quick Diagnostic Guide
I encountered a temporary connection glitch, but here is immediate advice for **"${textToSend}"**:

- **0 Points Lockout**: If your points balance is 0.0, click the **Points** tab to claim your **30 Free Points** (every 7 days), or visit the **Shop** for immediate refills.
- **Blurry TikTok**: TikTok compresses videos over 20MB. Choose **High Optimization (10 pts)** in BLESS METHOD to encode to 1080x1920 with CRF 20 and \`faststart\` MP4 metadata.
- **Encoding Errors**: Points are automatically refunded on any failed jobs. Check the **Engines & DB** tab to verify HandBrake status.`,
        timestamp: Date.now(),
        source: 'BLESS Local Knowledge Base',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: `Chat cleared. Ask me any technical question regarding video encoding, TikTok quality, points, or account issues.`,
        timestamp: Date.now(),
        source: 'BLESS AI Specialist',
      },
    ]);
  };

  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={i} className="font-bold text-neutral-900 text-base mt-2 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-600 inline-block"></span>
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={i} className="font-extrabold text-neutral-950 text-lg mt-3 mb-2">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemContent = trimmed.substring(2);
        return (
          <li key={i} className="ml-4 list-disc text-neutral-700 my-0.5 text-xs sm:text-sm">
            {renderInlineMarkdown(itemContent)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <li key={i} className="ml-4 list-decimal text-neutral-700 my-0.5 text-xs sm:text-sm">
            {renderInlineMarkdown(trimmed.replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={i} className="h-1.5" />;
      }
      return (
        <p key={i} className="text-neutral-700 text-xs sm:text-sm leading-relaxed my-1">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-neutral-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-neutral-100 text-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono border border-neutral-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              BLESS AI Assistant
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Gemini 3.8 Flash
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Help & Technical Support
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            Real-time AI assistance for HandBrakeCLI video encoding, TikTok blurriness fixes, points balance troubleshooting, and error diagnosis.
          </p>
        </div>

        {/* User Balance Status Pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center gap-2.5">
            <Coins className="w-4 h-4 text-violet-600" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-neutral-400 leading-tight">Your Balance</div>
              <div className="text-sm font-extrabold font-mono text-neutral-900 leading-tight">
                {(user?.pointsBalance ?? 0).toFixed(1)} <span className="text-xs font-normal text-neutral-500">pts</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-colors cursor-pointer"
            title="Reset conversation"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Quick Diagnoses & Presets (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Problem Prompts */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-neutral-400" />
              Common Problems & Fixes
            </h2>
            <div className="space-y-2">
              {PRESET_QUESTIONS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="w-full text-left p-3 rounded-xl border border-neutral-200 hover:border-violet-300 hover:bg-violet-50/40 transition-all group flex items-start gap-3 bg-white cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-neutral-100 group-hover:bg-violet-100 transition-colors text-neutral-700 group-hover:text-violet-700 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-neutral-900 group-hover:text-violet-950 transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">
                        {item.prompt}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-violet-600 self-center shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="bg-neutral-50/70 rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
              Direct Shortcuts
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={onOpenOptimizer}
                className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-colors flex flex-col justify-between cursor-pointer"
              >
                <Video className="w-4 h-4 text-violet-600 mb-2" />
                <span className="font-semibold text-neutral-900">Optimizer</span>
                <span className="text-[11px] text-neutral-500">Launch encoder</span>
              </button>

              <button
                onClick={onOpenPoints}
                className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-colors flex flex-col justify-between cursor-pointer"
              >
                <Coins className="w-4 h-4 text-emerald-600 mb-2" />
                <span className="font-semibold text-neutral-900">Points & Free</span>
                <span className="text-[11px] text-neutral-500">Claim 30 weekly</span>
              </button>

              <button
                onClick={onOpenShop}
                className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-colors flex flex-col justify-between cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500 mb-2" />
                <span className="font-semibold text-neutral-900">Points Shop</span>
                <span className="text-[11px] text-neutral-500">Refill packages</span>
              </button>

              <button
                onClick={onOpenSettings}
                className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-left transition-colors flex flex-col justify-between cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-blue-600 mb-2" />
                <span className="font-semibold text-neutral-900">Engines & DB</span>
                <span className="text-[11px] text-neutral-500">HandBrake status</span>
              </button>
            </div>
          </div>

          {/* Guarantee card */}
          <div className="rounded-2xl border border-neutral-200 p-4 bg-white flex items-start gap-3 text-xs text-neutral-600">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-900 block font-semibold">Automatic Refund Guarantee</strong>
              If HandBrake encoding encounters any unrecoverable error or corrupt file exception, points are instantly credited back to your balance.
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Chat Interface (8 cols on lg) */}
        <div className="lg:col-span-8 flex flex-col h-[650px] bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  BLESS Diagnostic Assistant
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  Powered by Gemini AI · Video Optimization Expert
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 hidden sm:block">
              24/7 Troubleshooting
            </div>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-neutral-50/30">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 max-w-[92%] sm:max-w-[85%] ${
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                      isUser
                        ? 'bg-neutral-900 text-white'
                        : 'bg-violet-600 text-white shadow-2xs'
                    }`}
                  >
                    {isUser ? 'U' : <Sparkles className="w-3.5 h-3.5" />}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm shadow-2xs leading-relaxed ${
                        isUser
                          ? 'bg-neutral-900 text-white rounded-tr-xs'
                          : 'bg-white border border-neutral-200 text-neutral-800 rounded-tl-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      ) : (
                        <div className="prose-neutral prose-sm">
                          {renderFormattedText(message.text)}
                        </div>
                      )}
                    </div>

                    {!isUser && (
                      <div className="flex items-center justify-between px-1 text-[11px] text-neutral-400">
                        <span>{message.source || 'BLESS AI'}</span>
                        <button
                          onClick={() => handleCopy(message.id, message.text)}
                          className="hover:text-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 max-w-[85%] mr-auto items-center text-xs text-neutral-500">
                <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-white border border-neutral-200 px-4 py-3 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-violet-600 animate-bounce"></span>
                  <span className="inline-block w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="inline-block w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 text-neutral-600">Analyzing problem & generating solution...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 bg-white border-t border-neutral-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe any issue (e.g., '0 points error', 'TikTok quality bad', 'HandBrake failed')..."
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className="px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <span>Ask AI</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 px-1">
              <span>Enter a question or error message for step-by-step resolution.</span>
              <span className="hidden sm:inline">BLESS AI Specialist v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
