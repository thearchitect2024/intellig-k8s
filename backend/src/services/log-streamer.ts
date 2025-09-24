import * as k8s from '@kubernetes/client-node';
import { LogStreamOptions } from '../types.js';
import { redactSecrets } from '../utils/secrets.js';
import { Readable, PassThrough } from 'stream';

export class LogStreamer {
  private k8sConfig: k8s.KubeConfig;
  private activeStreams: Map<string, PassThrough> = new Map();

  constructor(k8sConfig: k8s.KubeConfig) {
    this.k8sConfig = k8sConfig;
  }

  async startLogStream(
    options: LogStreamOptions,
    onData: (data: string) => void,
    onError: (error: Error) => void,
    onEnd: () => void
  ): Promise<string> {
    const { namespace, pod, container, since, tailLines = 100, follow = true } = options;
    
    const streamId = `${namespace}/${pod}/${container}`;
    
    // Stop any existing stream for this resource
    this.stopLogStream(streamId);

    try {
      const logApi = new k8s.Log(this.k8sConfig);
      
      // Convert 'since' duration to seconds if provided
      let sinceSeconds: number | undefined;
      if (since) {
        sinceSeconds = this.parseDuration(since);
      }

      const logStream = new PassThrough();
      
      // Start the log stream
      const req = await logApi.log(
        namespace,
        pod,
        container,
        logStream,
        {
          follow,
          tailLines,
          sinceSeconds,
          timestamps: true,
        }
      );

      // Store the stream for cleanup
      this.activeStreams.set(streamId, logStream);

      // Handle stream data
      logStream.on('data', (chunk: Buffer) => {
        const logData = chunk.toString('utf8');
        const sanitizedData = redactSecrets(logData);
        
        // Apply regex filter if provided
        if (options.regex) {
          const regex = new RegExp(options.regex, 'i');
          const lines = sanitizedData.split('\n');
          const filteredLines = lines.filter(line => regex.test(line));
          if (filteredLines.length > 0) {
            onData(filteredLines.join('\n'));
          }
        } else {
          onData(sanitizedData);
        }
      });

      logStream.on('error', (error: Error) => {
        console.error(`Log stream error for ${streamId}:`, error);
        this.activeStreams.delete(streamId);
        onError(error);
      });

      logStream.on('end', () => {
        console.log(`Log stream ended for ${streamId}`);
        this.activeStreams.delete(streamId);
        onEnd();
      });

      return streamId;
    } catch (error) {
      console.error(`Failed to start log stream for ${streamId}:`, error);
      throw new Error(`Failed to start log stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  stopLogStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.destroy();
      this.activeStreams.delete(streamId);
      console.log(`Stopped log stream: ${streamId}`);
    }
  }

  stopAllStreams(): void {
    for (const [streamId, stream] of this.activeStreams) {
      stream.destroy();
      console.log(`Stopped log stream: ${streamId}`);
    }
    this.activeStreams.clear();
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
  }
}

// Mock data for demo mode
export const MOCK_LOGS = {
  'image-pull-backoff': [
    '2024-01-20T10:15:30.123Z kubelet Failed to pull image "nginx:nonexistent": rpc error: code = NotFound desc = failed to pull and unpack image "docker.io/library/nginx:nonexistent": failed to resolve reference "docker.io/library/nginx:nonexistent": docker.io/library/nginx:nonexistent: not found',
    '2024-01-20T10:15:31.456Z kubelet Error: ErrImagePull',
    '2024-01-20T10:15:32.789Z kubelet Back-off pulling image "nginx:nonexistent"',
    '2024-01-20T10:15:33.012Z kubelet Error: ImagePullBackOff',
  ],
  'oom-killed': [
    '2024-01-20T10:20:15.123Z java -Xmx512m -jar app.jar',
    '2024-01-20T10:20:16.456Z Loading application context...',
    '2024-01-20T10:20:20.789Z OutOfMemoryError: Java heap space',
    '2024-01-20T10:20:21.012Z Process exited with code 137',
    '2024-01-20T10:20:22.345Z kubelet Container killed by OOM killer',
  ],
  'readiness-probe-fail': [
    '2024-01-20T10:25:10.123Z Starting HTTP server on port 8080',
    '2024-01-20T10:25:11.456Z Loading configuration...',
    '2024-01-20T10:25:15.789Z kubelet Readiness probe failed: Get "http://10.0.1.45:8080/health": dial tcp 10.0.1.45:8080: connect: connection refused',
    '2024-01-20T10:25:20.012Z kubelet Readiness probe failed: Get "http://10.0.1.45:8080/health": context deadline exceeded',
    '2024-01-20T10:25:25.345Z Application started successfully on port 8080',
    '2024-01-20T10:25:26.678Z kubelet Readiness probe succeeded',
  ],
  'normal-startup': [
    '2024-01-20T10:30:00.123Z Starting application...',
    '2024-01-20T10:30:01.456Z Loading configuration from /etc/config',
    '2024-01-20T10:30:02.789Z Connecting to database...',
    '2024-01-20T10:30:03.012Z Database connection established',
    '2024-01-20T10:30:04.345Z Starting HTTP server on port 8080',
    '2024-01-20T10:30:05.678Z Application ready to serve requests',
  ],
};
