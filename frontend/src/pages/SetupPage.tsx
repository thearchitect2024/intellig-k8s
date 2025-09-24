import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Cloud, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { encodeCredentials } from '@/lib/utils'

interface SetupPageProps {
  onContextSet: (context: any) => void
  initialContext: any
}

interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
  profile?: string
}

interface EKSCluster {
  name: string
  status: string
  endpoint?: string
  version?: string
}

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'sa-east-1', 'ca-central-1'
]

export default function SetupPage({ onContextSet, initialContext }: SetupPageProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('aws')
  const [demoMode, setDemoMode] = useState(false)
  
  // AWS form state
  const [awsCredentials, setAWSCredentials] = useState<AWSCredentials>({
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: 'us-west-2',
    profile: ''
  })
  const [clusters, setClusters] = useState<EKSCluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState('')
  
  // Kubeconfig form state
  const [kubeconfig, setKubeconfig] = useState('')
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'credentials' | 'cluster'>('credentials')
  const [, setCredentialsValid] = useState(false)

  useEffect(() => {
    if (initialContext) {
      if (initialContext.kubeconfig) {
        setActiveTab('kubeconfig')
        setKubeconfig(initialContext.kubeconfig)
      } else if (initialContext.credentials) {
        setActiveTab('aws')
        setAWSCredentials(initialContext.credentials)
        setSelectedCluster(initialContext.clusterName || '')
        if (initialContext.clusterName) {
          setStep('cluster')
        }
      }
    }
  }, [initialContext])

  const testAWSCredentials = async () => {
    if (!awsCredentials.accessKeyId || !awsCredentials.secretAccessKey) {
      setError('Access Key ID and Secret Access Key are required')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/aws/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(awsCredentials),
      })
      
      const result = await response.json()
      
      if (result.valid) {
        setCredentialsValid(true)
        await discoverClusters()
      } else {
        setError(result.error || 'Invalid AWS credentials')
        setCredentialsValid(false)
      }
    } catch (error) {
      setError('Failed to test AWS credentials')
      setCredentialsValid(false)
    } finally {
      setLoading(false)
    }
  }

  const discoverClusters = async () => {
    setLoading(true)
    setError('')
    
    try {
      const authHeader = `Bearer ${encodeCredentials(awsCredentials)}`
      const response = await fetch(`/api/eks/clusters?region=${awsCredentials.region}`, {
        headers: {
          'Authorization': authHeader,
        },
      })
      
      const result = await response.json()
      
      if (result.clusters) {
        setClusters(result.clusters)
        setStep('cluster')
      } else {
        setError(result.error || 'Failed to discover clusters')
      }
    } catch (error) {
      setError('Failed to discover EKS clusters')
    } finally {
      setLoading(false)
    }
  }

  const handleAWSSubmit = async () => {
    if (!selectedCluster) {
      setError('Please select a cluster')
      return
    }

    setLoading(true)
    setError('')

    try {
      const context = {
        region: awsCredentials.region,
        clusterName: selectedCluster,
        credentials: awsCredentials,
      }

      const response = await fetch('/api/k8s/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context),
      })

      const result = await response.json()

      if (result.success) {
        onContextSet(context)
        navigate('/logs')
      } else {
        setError(result.error || 'Failed to set K8s context')
      }
    } catch (error) {
      setError('Failed to configure Kubernetes context')
    } finally {
      setLoading(false)
    }
  }

  const handleKubeconfigSubmit = async () => {
    if (!kubeconfig.trim()) {
      setError('Kubeconfig is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const context = {
        kubeconfig: kubeconfig.trim(),
      }

      const response = await fetch('/api/k8s/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context),
      })

      const result = await response.json()

      if (result.success) {
        onContextSet(context)
        navigate('/logs')
      } else {
        setError(result.error || 'Failed to set K8s context')
      }
    } catch (error) {
      setError('Failed to configure Kubernetes context')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoMode = () => {
    const context = { demo: true }
    onContextSet(context)
    navigate('/logs')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            IntelliG K8s
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Live Pod Logs with AI Analysis
          </p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connect to Kubernetes</CardTitle>
                <CardDescription>
                  Choose your preferred method to connect to your Kubernetes cluster
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Demo Mode</span>
                <Switch
                  checked={demoMode}
                  onCheckedChange={setDemoMode}
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {demoMode ? (
              <div className="text-center py-8">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Cloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Demo Mode</h3>
                  <p className="text-muted-foreground mb-6">
                    Experience the app with simulated Kubernetes logs and AI analysis
                  </p>
                </div>
                <Button onClick={handleDemoMode} size="lg">
                  Start Demo
                </Button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="aws" className="flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    AWS/EKS
                  </TabsTrigger>
                  <TabsTrigger value="kubeconfig" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Kubeconfig
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="aws" className="space-y-6">
                  {step === 'credentials' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">AWS Access Key ID *</label>
                        <Input
                          type="text"
                          placeholder="AKIA..."
                          value={awsCredentials.accessKeyId}
                          onChange={(e) => setAWSCredentials(prev => ({
                            ...prev,
                            accessKeyId: e.target.value
                          }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">AWS Secret Access Key *</label>
                        <Input
                          type="password"
                          placeholder="Secret access key"
                          value={awsCredentials.secretAccessKey}
                          onChange={(e) => setAWSCredentials(prev => ({
                            ...prev,
                            secretAccessKey: e.target.value
                          }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Session Token (Optional)</label>
                        <Input
                          type="password"
                          placeholder="Session token for temporary credentials"
                          value={awsCredentials.sessionToken}
                          onChange={(e) => setAWSCredentials(prev => ({
                            ...prev,
                            sessionToken: e.target.value
                          }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">AWS Region *</label>
                        <Select
                          value={awsCredentials.region}
                          onValueChange={(value) => setAWSCredentials(prev => ({
                            ...prev,
                            region: value
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AWS_REGIONS.map(region => (
                              <SelectItem key={region} value={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">AWS Profile (Optional)</label>
                        <Input
                          type="text"
                          placeholder="default"
                          value={awsCredentials.profile}
                          onChange={(e) => setAWSCredentials(prev => ({
                            ...prev,
                            profile: e.target.value
                          }))}
                        />
                      </div>

                      <Button 
                        onClick={testAWSCredentials}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Cloud className="w-4 h-4 mr-2" />
                        )}
                        Discover EKS Clusters
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">AWS credentials validated</span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select EKS Cluster *</label>
                        <Select
                          value={selectedCluster}
                          onValueChange={setSelectedCluster}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a cluster" />
                          </SelectTrigger>
                          <SelectContent>
                            {clusters.map(cluster => (
                              <SelectItem key={cluster.name} value={cluster.name}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{cluster.name}</span>
                                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                    cluster.status === 'ACTIVE' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  }`}>
                                    {cluster.status}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setStep('credentials')}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button 
                          onClick={handleAWSSubmit}
                          disabled={loading || !selectedCluster}
                          className="flex-1"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Connect to Cluster
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="kubeconfig" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kubeconfig Content *</label>
                    <Textarea
                      placeholder="Paste your kubeconfig YAML content here..."
                      className="min-h-[200px] font-mono text-sm"
                      value={kubeconfig}
                      onChange={(e) => setKubeconfig(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleKubeconfigSubmit}
                    disabled={loading || !kubeconfig.trim()}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Connect with Kubeconfig
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>🔒 Your credentials are never stored and remain in memory only</p>
        </div>
      </div>
    </div>
  )
}
