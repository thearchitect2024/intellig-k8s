import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Search, Container, Layers, Box } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResourceNavigatorProps {
  context: any
  selection: {
    namespace: string
    pod: string
    container: string
    labelSelector?: string
  } | null
  onSelectionChange: (selection: any) => void
}

interface K8sResource {
  name: string
  namespace?: string
  labels?: Record<string, string>
  status?: string
  containers?: string[]
}

export default function ResourceNavigator({ context, selection, onSelectionChange }: ResourceNavigatorProps) {
  const [namespaces, setNamespaces] = useState<K8sResource[]>([])
  const [pods, setPods] = useState<K8sResource[]>([])
  const [containers, setContainers] = useState<K8sResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [selectedNamespace, setSelectedNamespace] = useState('')
  const [selectedPod, setSelectedPod] = useState('')
  const [selectedContainer, setSelectedContainer] = useState('')
  const [labelSelector, setLabelSelector] = useState('')
  const [podSearch, setPodSearch] = useState('')

  // Demo data
  const demoData = {
    namespaces: [
      { name: 'default' },
      { name: 'kube-system' },
      { name: 'production' },
      { name: 'staging' },
    ],
    pods: [
      { name: 'web-app-7d4b8f9c6-xk2p9', status: 'Running', containers: ['web-app', 'sidecar'] },
      { name: 'api-server-5b7c8d9e-mp3q1', status: 'Running', containers: ['api-server'] },
      { name: 'worker-6c8d9e0f-nq4r2', status: 'CrashLoopBackOff', containers: ['worker'] },
      { name: 'database-8e0f1g2h-rs5t3', status: 'Running', containers: ['postgres', 'backup'] },
    ],
    containers: [
      { name: 'web-app' },
      { name: 'sidecar' },
    ]
  }

  // Load namespaces on mount
  useEffect(() => {
    if (context.demo) {
      setNamespaces(demoData.namespaces)
      return
    }
    
    loadNamespaces()
  }, [context])

  // Load pods when namespace changes
  useEffect(() => {
    if (selectedNamespace) {
      if (context.demo) {
        setPods(demoData.pods)
        return
      }
      loadPods(selectedNamespace, labelSelector)
    } else {
      setPods([])
    }
  }, [selectedNamespace, labelSelector, context])

  // Load containers when pod changes
  useEffect(() => {
    if (selectedPod && selectedNamespace) {
      if (context.demo) {
        setContainers(demoData.containers)
        return
      }
      loadContainers(selectedNamespace, selectedPod)
    } else {
      setContainers([])
    }
  }, [selectedPod, selectedNamespace, context])

  // Update selection when all values are set
  useEffect(() => {
    if (selectedNamespace && selectedPod && selectedContainer) {
      onSelectionChange({
        namespace: selectedNamespace,
        pod: selectedPod,
        container: selectedContainer,
        labelSelector: labelSelector || undefined,
      })
    } else {
      onSelectionChange(null)
    }
  }, [selectedNamespace, selectedPod, selectedContainer, labelSelector, onSelectionChange])

  const loadNamespaces = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/k8s/namespaces')
      const result = await response.json()
      
      if (result.namespaces) {
        setNamespaces(result.namespaces)
      } else {
        setError(result.error || 'Failed to load namespaces')
      }
    } catch (error) {
      setError('Failed to connect to Kubernetes API')
    } finally {
      setLoading(false)
    }
  }

  const loadPods = async (namespace: string, labelSelector?: string) => {
    setLoading(true)
    setError('')
    
    try {
      const url = new URL('/api/k8s/pods', window.location.origin)
      url.searchParams.set('namespace', namespace)
      if (labelSelector) {
        url.searchParams.set('labelSelector', labelSelector)
      }
      
      const response = await fetch(url.toString())
      const result = await response.json()
      
      if (result.pods) {
        setPods(result.pods)
      } else {
        setError(result.error || 'Failed to load pods')
      }
    } catch (error) {
      setError('Failed to load pods')
    } finally {
      setLoading(false)
    }
  }

  const loadContainers = async (namespace: string, pod: string) => {
    setLoading(true)
    setError('')
    
    try {
      const url = new URL('/api/k8s/containers', window.location.origin)
      url.searchParams.set('namespace', namespace)
      url.searchParams.set('pod', pod)
      
      const response = await fetch(url.toString())
      const result = await response.json()
      
      if (result.containers) {
        setContainers(result.containers)
      } else {
        setError(result.error || 'Failed to load containers')
      }
    } catch (error) {
      setError('Failed to load containers')
    } finally {
      setLoading(false)
    }
  }

  const refresh = () => {
    if (selectedNamespace) {
      loadPods(selectedNamespace, labelSelector)
    } else {
      loadNamespaces()
    }
  }

  // Filter pods based on search
  const filteredPods = pods.filter(pod =>
    pod.name.toLowerCase().includes(podSearch.toLowerCase())
  )

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Running':
        return 'text-green-600 dark:text-green-400'
      case 'Pending':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'Failed':
      case 'CrashLoopBackOff':
      case 'Error':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Resource Navigator
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Namespace Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Container className="w-4 h-4" />
              Namespace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger>
                <SelectValue placeholder="Select namespace" />
              </SelectTrigger>
              <SelectContent>
                {namespaces.map(ns => (
                  <SelectItem key={ns.name} value={ns.name}>
                    {ns.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Label Selector */}
        {selectedNamespace && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Label Selector (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="app=web,version=v1.0"
                value={labelSelector}
                onChange={(e) => setLabelSelector(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {/* Pod Selection */}
        {selectedNamespace && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Box className="w-4 h-4" />
                Pods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pods..."
                  value={podSearch}
                  onChange={(e) => setPodSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredPods.map(pod => (
                  <div
                    key={pod.name}
                    className={cn(
                      'p-2 rounded cursor-pointer border transition-colors',
                      selectedPod === pod.name
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedPod(pod.name)}
                  >
                    <div className="font-mono text-sm">{pod.name}</div>
                    {pod.status && (
                      <div className={cn('text-xs', getStatusColor(pod.status))}>
                        {pod.status}
                      </div>
                    )}
                  </div>
                ))}
                {filteredPods.length === 0 && pods.length > 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No pods match your search
                  </div>
                )}
                {pods.length === 0 && !loading && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No pods found in this namespace
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Container Selection */}
        {selectedPod && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Containers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {containers.map(container => (
                  <div
                    key={container.name}
                    className={cn(
                      'p-2 rounded cursor-pointer border transition-colors',
                      selectedContainer === container.name
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedContainer(container.name)}
                  >
                    <div className="font-mono text-sm">{container.name}</div>
                  </div>
                ))}
                {containers.length === 0 && !loading && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No containers found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selection Summary */}
      {selection && (
        <div className="border-t p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Selected:</div>
          <div className="font-mono text-sm">
            <div>{selection.namespace}</div>
            <div className="text-muted-foreground">/{selection.pod}</div>
            <div className="text-muted-foreground">/{selection.container}</div>
          </div>
        </div>
      )}
    </div>
  )
}
