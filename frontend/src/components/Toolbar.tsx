import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Play, Square, Pause, RotateCcw, Download, Search } from 'lucide-react'

interface ToolbarProps {
  isStreaming: boolean
  isPaused: boolean
  onStart: () => void
  onStop: () => void
  onTogglePause: () => void
  onClear: () => void
  onExport: () => void
  filter: string
  onFilterChange: (value: string) => void
  wordWrap: boolean
  onWordWrapChange: (value: boolean) => void
  since: string
  onSinceChange: (value: string) => void
  canStart: boolean
}

export default function Toolbar({
  isStreaming,
  isPaused,
  onStart,
  onStop,
  onTogglePause,
  onClear,
  onExport,
  filter,
  onFilterChange,
  wordWrap,
  onWordWrapChange,
  since,
  onSinceChange,
  canStart,
}: ToolbarProps) {
  return (
    <div className="border-b bg-card px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* Stream controls */}
      <div className="flex items-center gap-2">
        {!isStreaming ? (
          <Button
            size="sm"
            onClick={onStart}
            disabled={!canStart}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onTogglePause}
              className="flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onStop}
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Since:</span>
        <Select value={since} onValueChange={onSinceChange}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">1m</SelectItem>
            <SelectItem value="5m">5m</SelectItem>
            <SelectItem value="15m">15m</SelectItem>
            <SelectItem value="1h">1h</SelectItem>
            <SelectItem value="6h">6h</SelectItem>
            <SelectItem value="24h">24h</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Filter */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter logs (regex supported) - Press / to focus"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Options */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Word wrap</span>
          <Switch
            checked={wordWrap}
            onCheckedChange={onWordWrapChange}
          />
        </div>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onClear}
          className="flex items-center gap-2"
          title="Clear logs (Ctrl+K)"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          className="flex items-center gap-2"
          title="Export logs (Ctrl+E)"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="ml-auto text-xs text-muted-foreground hidden lg:block">
        <span className="kbd">P</span> pause • <span className="kbd">/</span> filter • <span className="kbd">Ctrl+E</span> export
      </div>
    </div>
  )
}
