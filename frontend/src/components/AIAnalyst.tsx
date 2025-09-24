import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Send, Loader2, Info, Zap } from 'lucide-react'

interface AIAnalystProps {
  context: any
  selection: {
    namespace: string
    pod: string
    container: string
  } | null
  recentLogs: string
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface SuggestedCommand {
  command: string
  description: string
  type: 'describe' | 'events' | 'logs'
}

const AIAnalyst = forwardRef<any, AIAnalystProps>(({ context, selection, recentLogs }, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [suggestedCommands, setSuggestedCommands] = useState<SuggestedCommand[]>([])
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    analyzeNewLogs: (logs: string) => {
      // Debounce analysis calls
      const now = new Date()
      if (lastAnalysisTime && now.getTime() - lastAnalysisTime.getTime() < 5000) {
        return // Don't analyze too frequently
      }
      
      setLastAnalysisTime(now)
      analyzeLogsAutomatically(logs)
    }
  }))

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Add welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        type: 'system',
        content: context.demo 
          ? '🤖 **K8s Boot Advisor** - Demo Mode\n\nI\'m analyzing your simulated pod logs in real-time. I\'ll automatically explain what\'s happening and suggest next steps as logs stream in.\n\nTry asking me questions like:\n- "Why is this pod failing?"\n- "What should I check next?"\n- "Explain the startup sequence"'
          : '🤖 **K8s Boot Advisor** Ready\n\nI\'m your expert SRE assistant for Kubernetes troubleshooting. I\'ll analyze your pod logs in real-time and provide:\n\n• **Automatic analysis** as logs stream\n• **Probable causes** with confidence levels\n• **Concrete next steps** and kubectl commands\n• **Pattern recognition** for common issues\n\nSelect a pod and start streaming to begin!',
        timestamp: new Date(),
      }])
    }
  }, [context.demo, messages.length])

  const analyzeLogsAutomatically = async (logs: string) => {
    if (!selection || !logs.trim() || isAnalyzing) return

    // Skip if no significant new content
    if (logs.length < 50) return

    setIsAnalyzing(true)

    try {
      const analysisMessage: ChatMessage = {
        id: `auto-${Date.now()}`,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }

      setMessages(prev => [...prev, analysisMessage])

      await streamAnalysis({
        meta: {
          cluster: context.clusterName || 'demo',
          namespace: selection.namespace,
          pod: selection.pod,
          container: selection.container,
        },
        recentLogChunk: logs,
      }, analysisMessage.id)

    } catch (error) {
      console.error('Auto-analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleUserQuestion = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)

    try {
      await streamAnalysis({
        meta: {
          cluster: context.clusterName || 'demo',
          namespace: selection?.namespace || 'default',
          pod: selection?.pod || 'demo-pod',
          container: selection?.container || 'demo-container',
        },
        recentLogChunk: recentLogs,
        question: userMessage.content,
      }, assistantMessage.id)

    } catch (error) {
      console.error('Analysis failed:', error)
      updateMessage(assistantMessage.id, '❌ Sorry, I encountered an error analyzing the logs. Please try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  const streamAnalysis = async (request: any, messageId: string) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      let content = ''
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        content += chunk
        
        updateMessage(messageId, content)
      }

      // Extract suggested commands from the response
      extractSuggestedCommands(content)

      // Mark as complete
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isStreaming: false }
          : msg
      ))

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Analysis request aborted')
        return
      }
      
      console.error('Stream analysis error:', error)
      updateMessage(messageId, `❌ Analysis failed: ${error.message}`)
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isStreaming: false }
          : msg
      ))
    }
  }

  const updateMessage = (messageId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content }
        : msg
    ))
  }

  const extractSuggestedCommands = (content: string) => {
    const commands: SuggestedCommand[] = []
    
    // Extract kubectl commands from the content
    const kubectlRegex = /`kubectl\s+([^`]+)`/g
    let match
    
    while ((match = kubectlRegex.exec(content)) !== null) {
      const command = `kubectl ${match[1]}`
      
      let type: 'describe' | 'events' | 'logs' = 'describe'
      if (command.includes('describe')) type = 'describe'
      else if (command.includes('events')) type = 'events'
      else if (command.includes('logs')) type = 'logs'
      
      commands.push({
        command,
        description: `Run: ${command}`,
        type,
      })
    }
    
    setSuggestedCommands(commands.slice(0, 3)) // Limit to 3 suggestions
  }

  const executeSuggestedCommand = async (command: SuggestedCommand) => {
    if (!selection || context.demo) {
      // Show demo response for demo mode
      const demoResponse = getDemoCommandResponse(command)
      const responseMessage: ChatMessage = {
        id: `cmd-${Date.now()}`,
        type: 'assistant',
        content: `**Executed:** \`${command.command}\`\n\n\`\`\`\n${demoResponse}\n\`\`\``,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, responseMessage])
      return
    }

    // Execute real command
    try {
      let endpoint = ''
      const params = new URLSearchParams()
      
      if (command.type === 'describe') {
        endpoint = '/api/k8s/describe/pod'
        params.set('namespace', selection.namespace)
        params.set('pod', selection.pod)
      } else if (command.type === 'events') {
        endpoint = '/api/k8s/events'
        params.set('namespace', selection.namespace)
      }
      
      if (endpoint) {
        const response = await fetch(`${endpoint}?${params}`)
        const result = await response.json()
        
        const responseMessage: ChatMessage = {
          id: `cmd-${Date.now()}`,
          type: 'assistant',
          content: `**Executed:** \`${command.command}\`\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, responseMessage])
      }
    } catch (error) {
      console.error('Command execution failed:', error)
    }
  }

  const getDemoCommandResponse = (command: SuggestedCommand) => {
    if (command.command.includes('describe')) {
      return `Name:         demo-pod-7d4b8f9c6-xk2p9
Namespace:    default
Status:       Running
Containers:
  demo-container:
    State:          Running
    Ready:          True
    Restart Count:  0
Events:
  Normal  Scheduled  2m    default-scheduler  Successfully assigned default/demo-pod-7d4b8f9c6-xk2p9 to node-1
  Normal  Pulled     2m    kubelet            Container image "nginx:1.21" successfully pulled
  Normal  Created    2m    kubelet            Created container demo-container
  Normal  Started    2m    kubelet            Started container demo-container`
    }
    
    if (command.command.includes('events')) {
      return `LAST SEEN   TYPE     REASON      OBJECT                    MESSAGE
2m          Normal   Scheduled   pod/demo-pod-7d4b8f9c6-xk2p9   Successfully assigned default/demo-pod-7d4b8f9c6-xk2p9 to node-1
2m          Normal   Pulled      pod/demo-pod-7d4b8f9c6-xk2p9   Container image "nginx:1.21" successfully pulled
2m          Normal   Created     pod/demo-pod-7d4b8f9c6-xk2p9   Created container demo-container
2m          Normal   Started     pod/demo-pod-7d4b8f9c6-xk2p9   Started container demo-container`
    }
    
    return 'Command executed successfully.'
  }

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^- (.*$)/gim, '• $1')
      .replace(/\n/g, '<br />')
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">U</div>
      case 'assistant':
        return <Brain className="w-6 h-6 text-purple-500" />
      case 'system':
        return <Info className="w-6 h-6 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4" />
          AI Analyst
          {isAnalyzing && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className="flex-shrink-0 mt-1">
                {getMessageIcon(message.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {message.type === 'user' ? 'You' : message.type === 'assistant' ? 'AI Analyst' : 'System'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {message.isStreaming && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div 
                  className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Suggested Commands */}
        {suggestedCommands.length > 0 && (
          <div className="border-t p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              Suggested Commands
            </div>
            <div className="space-y-2">
              {suggestedCommands.map((cmd, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left font-mono text-xs"
                  onClick={() => executeSuggestedCommand(cmd)}
                >
                  {cmd.command}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about the logs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleUserQuestion()
                }
              }}
              disabled={isStreaming}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleUserQuestion}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send • I analyze logs automatically as they stream
          </div>
        </div>
      </div>
    </div>
  )
})

AIAnalyst.displayName = 'AIAnalyst'

export default AIAnalyst
