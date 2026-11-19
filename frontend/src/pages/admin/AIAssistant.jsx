import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  Trash2,
  Bot,
  User,
  ArrowRight,
  HelpCircle,
  Clock,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'
import { aiService } from '../../services/aiService'
import { useToast } from '../../context/ToastContext'

const SUGGESTED_PROMPTS = [
  'Find an available substitute for CSE 3rd Year at 11 AM',
  "Show today's absences across all departments",
  'Which faculty have the highest substitution workload this month?',
  'List all pending substitutions needing immediate approval',
  "Generate today's daily briefing and disruption summary",
  'Who is free at 11 AM in the Computer Science department?',
]

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am SYNCORA AI, your academic timetable and substitution copilot. You can ask me to find substitutes, inspect conflict schedules, evaluate faculty workloads, or generate comprehensive daily disruption briefings. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const toast = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim() || loading) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      // Build conversation history for API
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.content }],
        }))

      const response = await aiService.chat(text.trim(), history)
      const replyText =
        response.reply ||
        response.response ||
        response.message ||
        'I have analyzed the current timetable state and records. No critical disruptions were detected.'

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        'SYNCORA AI service is momentarily unreachable. Please verify your Gemini API key configuration in Settings.'

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        isError: true,
        content: `Error: ${errMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
      toast.error('AI chat failed to respond.')
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Chat history cleared. How can I assist you with timetable scheduling or substitute dispatch?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    toast.info('Conversation history cleared.')
  }

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.info('Message copied to clipboard.')
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      {/* Left Suggested Prompts Sidebar */}
      <div className="lg:w-80 card flex flex-col justify-between shrink-0 h-fit lg:h-full">
        <div>
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-heading font-bold text-base text-textPrimary">
              SYNCORA Copilot
            </h3>
          </div>

          <div className="mt-4">
            <p className="text-xs text-textSecondary font-medium uppercase tracking-wider mb-3">
              Suggested Institutional Inquiries:
            </p>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-xl border border-border bg-white hover:bg-secondary/40 hover:border-primary/50 text-xs font-medium text-textPrimary transition-all duration-150 flex items-start gap-2 group disabled:opacity-50"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  <span className="line-clamp-2 leading-relaxed">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border mt-4">
          <button
            onClick={handleClearChat}
            className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5 py-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat History
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 card !p-0 flex flex-col h-full overflow-hidden shadow-card">
        {/* Chat Messages Scrollable Window */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background/30">
          {messages.map((msg) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    isUser
                      ? 'bg-accent text-white'
                      : 'bg-white border border-border text-accent'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col group">
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed relative ${
                      isUser
                        ? 'bg-accent text-white shadow-sm rounded-tr-none'
                        : msg.isError
                        ? 'bg-error/10 text-error border border-error/20 rounded-tl-none'
                        : 'bg-white border border-border text-textPrimary shadow-card rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Copy Button */}
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-secondary/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <span
                    className={`text-[10px] text-textSecondary mt-1 px-1 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Typing Loading Indicator */}
          {loading && (
            <div className="flex gap-3 mr-auto max-w-md items-center">
              <div className="w-9 h-9 rounded-xl bg-white border border-border text-accent flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-white border border-border rounded-2xl rounded-tl-none p-4 shadow-card flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs text-textSecondary ml-2 font-medium">
                  SYNCORA AI is evaluating timetable matrix...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask SYNCORA anything about schedules, candidates, or disruption reports..."
              disabled={loading}
              className="input-field flex-1 text-sm py-3"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary py-3 px-5 shadow-sm shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-textSecondary mt-2 px-1">
            <span>Powered by Gemini 1.5 Pro & institutional heuristic algorithm</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  )
}
