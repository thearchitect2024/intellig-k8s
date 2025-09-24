import { useEffect, useRef, useState } from 'react'
import { FixedSizeList as List } from 'react-window'
import { formatTimestamp, detectLogLevel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Copy, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogEntry {
  timestamp: string
  message: string
  level?: string
}

interface LogViewerProps {
  logs: LogEntry[]
  filter: string
  wordWrap: boolean
  isPaused: boolean
  isStreaming: boolean
}

interface LogLineProps {
  index: number
  style: React.CSSProperties
  data: {
    logs: LogEntry[]
    filter: string
    wordWrap: boolean
  }
}

function LogLine({ index, style, data }: LogLineProps) {
  const { logs, filter, wordWrap } = data
  const log = logs[index]
  
  if (!log) return null

  const level = detectLogLevel(log.message)
  const timestamp = formatTimestamp(log.timestamp)
  
  // Apply filter
  let message = log.message
  if (filter) {
    try {
      const regex = new RegExp(filter, 'gi')
      if (!regex.test(message)) {
        return null
      }
      // Highlight matches
      message = message.replace(regex, (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>`)
    } catch {
      // Invalid regex, fall back to simple string match
      if (!message.toLowerCase().includes(filter.toLowerCase())) {
        return null
      }
    }
  }

  return (
    <div
      style={style}
      className={cn(
        'log-line border-b border-border/50',
        level && `log-line ${level}`,
        wordWrap ? 'whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden'
      )}
    >
      <div className="flex gap-3 items-start">
        <span className="text-muted-foreground text-xs font-mono w-20 flex-shrink-0 pt-0.5">
          {timestamp}
        </span>
        <span 
          className="flex-1 font-mono text-sm"
          dangerouslySetInnerHTML={{ __html: message }}
        />
      </div>
    </div>
  )
}

export default function LogViewer({ logs, filter, wordWrap, isPaused, isStreaming }: LogViewerProps) {
  const listRef = useRef<List>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (!filter) return true
    try {
      const regex = new RegExp(filter, 'i')
      return regex.test(log.message)
    } catch {
      return log.message.toLowerCase().includes(filter.toLowerCase())
    }
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && !isUserScrolling && filteredLogs.length > 0) {
      listRef.current?.scrollToItem(filteredLogs.length - 1, 'end')
    }
  }, [filteredLogs.length, autoScroll, isPaused, isUserScrolling])

  // Handle scroll events to detect user scrolling
  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }: any) => {
    if (!scrollUpdateWasRequested) {
      // User initiated scroll
      setIsUserScrolling(true)
      
      // Check if user scrolled to bottom
      const container = containerRef.current
      if (container) {
        const { scrollHeight, clientHeight } = container
        const isAtBottom = scrollOffset + clientHeight >= scrollHeight - 50
        setAutoScroll(isAtBottom)
      }
      
      // Reset user scrolling flag after a delay
      setTimeout(() => setIsUserScrolling(false), 1000)
    }
  }

  const copyAllLogs = () => {
    const content = filteredLogs
      .map(log => `${log.timestamp} ${log.message}`)
      .join('\n')
    
    navigator.clipboard.writeText(content)
  }

  const scrollToBottom = () => {
    setAutoScroll(true)
    setIsUserScrolling(false)
    if (filteredLogs.length > 0) {
      listRef.current?.scrollToItem(filteredLogs.length - 1, 'end')
    }
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          {logs.length === 0 ? (
            <>
              <div className="text-lg mb-2">No logs yet</div>
              <div className="text-sm">
                {isStreaming ? 'Waiting for log data...' : 'Select a pod and container to start streaming logs'}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg mb-2">No matching logs</div>
              <div className="text-sm">Try adjusting your filter</div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={copyAllLogs}
          className="opacity-80 hover:opacity-100"
          title="Copy all visible logs"
        >
          <Copy className="w-4 h-4" />
        </Button>
        {!autoScroll && (
          <Button
            size="sm"
            variant="secondary"
            onClick={scrollToBottom}
            className="opacity-80 hover:opacity-100"
            title="Scroll to bottom"
          >
            ↓
          </Button>
        )}
      </div>

      {/* Status indicator */}
      {isPaused && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-sm">
          <Pause className="w-4 h-4" />
          Paused
        </div>
      )}

      {isStreaming && !isPaused && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live
        </div>
      )}

      {/* Log list */}
      <div ref={containerRef} className="flex-1 log-viewer">
        <List
          ref={listRef}
          height={containerRef.current?.clientHeight || 600}
          width="100%"
          itemCount={filteredLogs.length}
          itemSize={wordWrap ? 60 : 32} // Adjust height based on word wrap
          itemData={{
            logs: filteredLogs,
            filter,
            wordWrap,
          }}
          onScroll={handleScroll}
          overscanCount={50}
        >
          {LogLine}
        </List>
      </div>

      {/* Log count indicator */}
      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {filteredLogs.length.toLocaleString()} lines
          {filter && logs.length !== filteredLogs.length && (
            <span> (filtered from {logs.length.toLocaleString()})</span>
          )}
        </span>
        <span>
          {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
        </span>
      </div>
    </div>
  )
}
