import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ResourceNavigator from '@/components/ResourceNavigator'
import LogViewer from '@/components/LogViewer'
import AIAnalyst from '@/components/AIAnalyst'
import Toolbar from '@/components/Toolbar'
import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Settings, Moon, Sun, Monitor } from 'lucide-react'

interface LogsPageProps {
  context: any
  onReset: () => void
}

interface LogEntry {
  timestamp: string
  message: string
  level?: string
}

interface ResourceSelection {
  namespace: string
  pod: string
  container: string
  labelSelector?: string
}

export default function LogsPage({ context }: LogsPageProps) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [selection, setSelection] = useState<ResourceSelection | null>(null)
  const [filter, setFilter] = useState('')
  const [wordWrap, setWordWrap] = useState(false)
  const [since, setSince] = useState('5m')
  const wsRef = useRef<WebSocket | null>(null)
  const logBufferRef = useRef<string[]>([])
  const aiAnalystRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const startLogStream = () => {
    if (!selection || isStreaming) return

    const { namespace, pod, container } = selection
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Build WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = new URL(`${wsProtocol}//${window.location.host}/ws/logs`)
    
    if (context.demo) {
      wsUrl.searchParams.set('demo', 'true')
      wsUrl.searchParams.set('scenario', 'normal-startup')
    } else {
      wsUrl.searchParams.set('ns', namespace)
      wsUrl.searchParams.set('pod', pod)
      wsUrl.searchParams.set('container', container)
      wsUrl.searchParams.set('since', since)
      if (filter) {
        wsUrl.searchParams.set('regex', filter)
      }
    }

    const ws = new WebSocket(wsUrl.toString())
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsStreaming(true)
      setLogs([]) // Clear existing logs
      logBufferRef.current = []
    }

    ws.onmessage = (event) => {
      if (isPaused) return

      try {
        // Try to parse as JSON (for error messages)
        const data = JSON.parse(event.data)
        if (data.error) {
          console.error('Log stream error:', data.error)
          return
        }
        if (data.event === 'stream_ended') {
          console.log('Log stream ended')
          setIsStreaming(false)
          return
        }
      } catch {
        // Regular log line
        const logLine = event.data.trim()
        if (!logLine) return

        // Add to buffer for AI analysis
        logBufferRef.current.push(logLine)
        if (logBufferRef.current.length > 1000) {
          logBufferRef.current = logBufferRef.current.slice(-1000)
        }

        // Parse timestamp and message
        const timestampMatch = logLine.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\s+(.*)$/)
        
        const logEntry: LogEntry = timestampMatch
          ? {
              timestamp: timestampMatch[1],
              message: timestampMatch[2],
            }
          : {
              timestamp: new Date().toISOString(),
              message: logLine,
            }

        setLogs(prev => {
          const newLogs = [...prev, logEntry]
          // Keep only last 10,000 lines for performance
          return newLogs.length > 10000 ? newLogs.slice(-10000) : newLogs
        })

        // Trigger AI analysis periodically
        if (aiAnalystRef.current && logBufferRef.current.length % 10 === 0) {
          const recentLogs = logBufferRef.current.slice(-50).join('\n')
          aiAnalystRef.current.analyzeNewLogs(recentLogs)
        }
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsStreaming(false)
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
      setIsStreaming(false)
    }
  }

  const stopLogStream = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  const clearLogs = () => {
    setLogs([])
    logBufferRef.current = []
  }

  const exportLogs = () => {
    const content = logs.map(log => `${log.timestamp} ${log.message}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `k8s-logs-${selection?.namespace}-${selection?.pod}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />
      case 'dark': return <Moon className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'p':
            e.preventDefault()
            togglePause()
            break
          case 'e':
            e.preventDefault()
            exportLogs()
            break
          case 'k':
            e.preventDefault()
            clearLogs()
            break
        }
      } else {
        switch (e.key) {
          case '/':
            e.preventDefault()
            // Focus filter input
            const filterInput = document.querySelector('input[placeholder*="filter"]') as HTMLInputElement
            if (filterInput) {
              filterInput.focus()
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [logs])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">IntelliG K8s</h1>
          {context.demo && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
              Demo Mode
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            title="Toggle theme"
          >
            {getThemeIcon()}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/setup')}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        isStreaming={isStreaming}
        isPaused={isPaused}
        onStart={startLogStream}
        onStop={stopLogStream}
        onTogglePause={togglePause}
        onClear={clearLogs}
        onExport={exportLogs}
        filter={filter}
        onFilterChange={setFilter}
        wordWrap={wordWrap}
        onWordWrapChange={setWordWrap}
        since={since}
        onSinceChange={setSince}
        canStart={!!selection}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane - Resource Navigator */}
        <div className="w-80 border-r bg-card">
          <ResourceNavigator
            context={context}
            selection={selection}
            onSelectionChange={setSelection}
          />
        </div>

        {/* Center pane - Log Viewer */}
        <div className="flex-1 flex flex-col">
          <LogViewer
            logs={logs}
            filter={filter}
            wordWrap={wordWrap}
            isPaused={isPaused}
            isStreaming={isStreaming}
          />
        </div>

        {/* Right pane - AI Analyst */}
        <div className="w-96 border-l bg-card">
          <AIAnalyst
            ref={aiAnalystRef}
            context={context}
            selection={selection}
            recentLogs={logBufferRef.current.slice(-100).join('\n')}
          />
        </div>
      </div>
    </div>
  )
}
