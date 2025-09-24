import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { K8sClientManager } from './services/k8s-client.js';
import { AIAnalyst } from './services/ai-analyst.js';
import { LogStreamer, MOCK_LOGS } from './services/log-streamer.js';
import { AWSCredentials, K8sContext, AIAnalysisRequest, LogStreamOptions } from './types.js';

// Load environment variables
config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Global state
const k8sClient = new K8sClientManager();
let aiAnalyst: AIAnalyst | null = null;
let logStreamer: LogStreamer | null = null;

// Initialize AI analyst if API key is available
if (process.env.MODEL_API_KEY) {
  aiAnalyst = new AIAnalyst(process.env.MODEL_API_KEY, process.env.MODEL_NAME || 'gpt-4');
}

// Register plugins
await fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
});

await fastify.register(websocket);

// Health check
fastify.get('/api/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiEnabled: !!aiAnalyst,
  };
});

// AWS/EKS Routes
fastify.post<{ Body: AWSCredentials }>('/api/auth/aws/test', async (request, reply) => {
  try {
    const credentials = request.body;
    const isValid = await k8sClient.testAWSCredentials(credentials);
    return { valid: isValid };
  } catch (error) {
    reply.code(400);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

fastify.get<{ Querystring: { region: string } }>('/api/eks/clusters', async (request, reply) => {
  try {
    const { region } = request.query;
    
    // Try to get credentials from headers (if provided via UI)
    const authHeader = request.headers.authorization;
    let credentials: AWSCredentials | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const credentialsJson = Buffer.from(authHeader.slice(7), 'base64').toString();
        credentials = JSON.parse(credentialsJson);
      } catch (e) {
        // Ignore invalid auth header, will use default credentials
      }
    }
    
    const clusters = await k8sClient.listEKSClusters(region, credentials);
    return { clusters };
  } catch (error) {
    reply.code(500);
    return { 
      clusters: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// K8s Context Management
fastify.post<{ Body: K8sContext }>('/api/k8s/context', async (request, reply) => {
  try {
    const context = request.body;
    await k8sClient.setContext(context);
    
    // Initialize log streamer with new context
    const k8sConfig = k8sClient.getConfig();
    logStreamer = new LogStreamer(k8sConfig);
    
    return { success: true, context: k8sClient.getCurrentContext() };
  } catch (error) {
    reply.code(400);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// K8s Resource Routes
fastify.get('/api/k8s/namespaces', async (request, reply) => {
  try {
    const api = k8sClient.getApi();
    const response = await api.listNamespace();
    
    const namespaces = response.body.items.map(ns => ({
      name: ns.metadata?.name || '',
      labels: ns.metadata?.labels || {},
      createdAt: ns.metadata?.creationTimestamp,
    }));
    
    return { namespaces };
  } catch (error) {
    reply.code(500);
    return { 
      namespaces: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

fastify.get<{ Querystring: { namespace: string; labelSelector?: string } }>('/api/k8s/pods', async (request, reply) => {
  try {
    const { namespace, labelSelector } = request.query;
    const api = k8sClient.getApi();
    
    const response = await api.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector);
    
    const pods = response.body.items.map(pod => ({
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      labels: pod.metadata?.labels || {},
      status: pod.status?.phase || 'Unknown',
      createdAt: pod.metadata?.creationTimestamp,
      containers: pod.spec?.containers.map(c => c.name) || [],
    }));
    
    return { pods };
  } catch (error) {
    reply.code(500);
    return { 
      pods: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

fastify.get<{ Querystring: { namespace: string; pod: string } }>('/api/k8s/containers', async (request, reply) => {
  try {
    const { namespace, pod } = request.query;
    const api = k8sClient.getApi();
    
    const response = await api.readNamespacedPod(pod, namespace);
    const podSpec = response.body.spec;
    
    if (!podSpec) {
      throw new Error('Pod spec not found');
    }
    
    const containers = [
      ...(podSpec.containers || []).map(c => ({ name: c.name, type: 'container' })),
      ...(podSpec.initContainers || []).map(c => ({ name: c.name, type: 'init' })),
    ];
    
    return { containers };
  } catch (error) {
    reply.code(500);
    return { 
      containers: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// K8s Describe and Events
fastify.get<{ Querystring: { namespace: string; pod: string } }>('/api/k8s/describe/pod', async (request, reply) => {
  try {
    const { namespace, pod } = request.query;
    const api = k8sClient.getApi();
    
    const response = await api.readNamespacedPod(pod, namespace);
    return { pod: response.body };
  } catch (error) {
    reply.code(500);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

fastify.get<{ Querystring: { namespace: string } }>('/api/k8s/events', async (request, reply) => {
  try {
    const { namespace } = request.query;
    const api = k8sClient.getApi();
    
    const response = await api.listNamespacedEvent(namespace);
    const events = response.body.items
      .sort((a, b) => {
        const aTime = new Date(a.lastTimestamp || a.eventTime || 0).getTime();
        const bTime = new Date(b.lastTimestamp || b.eventTime || 0).getTime();
        return bTime - aTime; // Most recent first
      })
      .slice(0, 50); // Limit to 50 most recent events
    
    return { events };
  } catch (error) {
    reply.code(500);
    return { 
      events: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// AI Analysis
fastify.post<{ Body: AIAnalysisRequest }>('/api/ai/explain', async (request, reply) => {
  if (!aiAnalyst) {
    reply.code(503);
    return { error: 'AI analyst not available. Please configure MODEL_API_KEY.' };
  }
  
  try {
    const analysisRequest = request.body;
    
    // Set content type for streaming
    reply.type('text/plain');
    
    const stream = await aiAnalyst.analyzeStream(analysisRequest);
    
    for await (const chunk of stream) {
      reply.raw.write(chunk);
    }
    
    reply.raw.end();
  } catch (error) {
    reply.code(500);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Demo mode endpoint
fastify.get<{ Querystring: { scenario: string } }>('/api/demo/logs', async (request, reply) => {
  const { scenario } = request.query;
  
  if (!MOCK_LOGS[scenario as keyof typeof MOCK_LOGS]) {
    reply.code(404);
    return { error: 'Scenario not found' };
  }
  
  const logs = MOCK_LOGS[scenario as keyof typeof MOCK_LOGS];
  return { logs };
});

// WebSocket for log streaming
fastify.register(async function (fastify) {
  fastify.get('/ws/logs', { websocket: true }, (connection, request) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const params = url.searchParams;
    
    const options: LogStreamOptions = {
      namespace: params.get('ns') || '',
      pod: params.get('pod') || '',
      container: params.get('container') || '',
      since: params.get('since') || undefined,
      regex: params.get('regex') || undefined,
      follow: params.get('follow') !== 'false',
    };
    
    // Handle demo mode
    if (params.get('demo') === 'true') {
      const scenario = params.get('scenario') || 'normal-startup';
      const logs = MOCK_LOGS[scenario as keyof typeof MOCK_LOGS] || MOCK_LOGS['normal-startup'];
      
      // Simulate streaming with delays
      let index = 0;
      const sendNextLog = () => {
        if (index < logs.length && connection.readyState === connection.OPEN) {
          connection.send(logs[index] + '\n');
          
          // Add to AI analyst buffer if available
          if (aiAnalyst) {
            aiAnalyst.addLogChunk(logs[index]);
          }
          
          index++;
          setTimeout(sendNextLog, 1000 + Math.random() * 2000); // Random delay 1-3s
        }
      };
      
      setTimeout(sendNextLog, 500); // Start after 500ms
      return;
    }
    
    // Real log streaming
    if (!logStreamer) {
      connection.send(JSON.stringify({ error: 'K8s context not set' }));
      return;
    }
    
    let streamId: string;
    
    logStreamer.startLogStream(
      options,
      (data) => {
        if (connection.readyState === connection.OPEN) {
          connection.send(data);
          
          // Add to AI analyst buffer
          if (aiAnalyst) {
            aiAnalyst.addLogChunk(data);
          }
        }
      },
      (error) => {
        if (connection.readyState === connection.OPEN) {
          connection.send(JSON.stringify({ error: error.message }));
        }
      },
      () => {
        if (connection.readyState === connection.OPEN) {
          connection.send(JSON.stringify({ event: 'stream_ended' }));
        }
      }
    ).then(id => {
      streamId = id;
    }).catch(error => {
      if (connection.readyState === connection.OPEN) {
        connection.send(JSON.stringify({ error: error.message }));
      }
    });
    
    connection.on('close', () => {
      if (streamId && logStreamer) {
        logStreamer.stopLogStream(streamId);
      }
    });
    
    // Ping/pong for keepalive
    const pingInterval = setInterval(() => {
      if (connection.readyState === connection.OPEN) {
        connection.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    connection.on('close', () => {
      clearInterval(pingInterval);
    });
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  
  if (logStreamer) {
    logStreamer.stopAllStreams();
  }
  
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  
  if (logStreamer) {
    logStreamer.stopAllStreams();
  }
  
  await fastify.close();
  process.exit(0);
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
