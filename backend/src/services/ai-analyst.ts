import OpenAI from 'openai';
import { AIAnalysisRequest } from '../types.js';
import { redactSecrets } from '../utils/secrets.js';

const SYSTEM_PROMPT = `You are "K8s Boot Advisor," an expert SRE for Kubernetes/EKS, containers, networking, and Java/Node/Python runtimes. You analyze **live pod logs** during startup and restarts. Be concise, actionable, and confident about common failure patterns.

When you see known signatures, output a short summary, **probable causes with confidence percentages**, and **next checks** as concrete commands (e.g., \`kubectl describe pod <pod> -n <ns>\`, \`kubectl get events -n <ns> --sort-by=.lastTimestamp\`, \`kubectl logs <pod> -c <container> --previous\`, \`kubectl get ep svc -n <ns>\`, etc.).

Prioritize these categories: image pull/auth, CrashLoopBackOff, OOMKilled/memory limits, CPU throttling, readiness/liveness probe failures, PVC mount issues, DNS/network/Service/Endpoint, ConfigMap/Secret missing, env var mistakes, dependency timeouts (DB/Kafka/S3), TLS cert errors, and version skew.

Always keep the **most recent context** in mind; don't overfit to old lines. If uncertain, say so and propose the top 2–3 verification steps. Keep each response under ~180 words.

Few-shot patterns:
- **ImagePullBackOff** → Likely bad image name/tag or registry auth. Next: \`kubectl describe pod …\` (Events), verify image and secret, check ECR permissions, retry pull.
- **CrashLoopBackOff + ExitCode 137** → OOMKilled. Next: check container memory limits/requests, review heap flags, \`kubectl logs … --previous\`, inspect GC/OOM lines.
- **Readiness probe failing (HTTP 503)** → App not listening yet or wrong path/port. Next: confirm containerPort vs service targetPort, readiness path, startup delay.
- **MountVolume.SetUp failed** → PVC not bound or wrong StorageClass/access mode. Next: \`kubectl get pvc,pv …\`, verify RWO vs RWX, node affinity.
- **Kafka timeout / Connection refused** → NetworkPolicy, DNS, or broker down. Next: \`kubectl get svc/endpoints\`, DNS resolution from pod, broker security protocol.`;

export class AIAnalyst {
  private openai: OpenAI;
  private logBuffer: string[] = [];
  private maxBufferSize: number = 2000; // ~200KB of logs

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.openai = new OpenAI({
      apiKey,
    });
  }

  addLogChunk(logChunk: string): void {
    const lines = logChunk.split('\n').filter(line => line.trim());
    this.logBuffer.push(...lines);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  getRecentLogs(maxLines: number = 100): string {
    const recentLines = this.logBuffer.slice(-maxLines);
    return recentLines.join('\n');
  }

  async analyzeStream(request: AIAnalysisRequest): Promise<AsyncIterable<string>> {
    const { meta, recentLogChunk, question } = request;
    
    // Redact secrets from logs before sending to AI
    const sanitizedLogs = redactSecrets(recentLogChunk);
    
    const userPrompt = question 
      ? `User question: ${question}\n\nRecent logs from ${meta.namespace}/${meta.pod}/${meta.container}:\n\`\`\`\n${sanitizedLogs}\n\`\`\``
      : `Analyze these recent logs from ${meta.namespace}/${meta.pod}/${meta.container}:\n\`\`\`\n${sanitizedLogs}\n\`\`\``;

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
        max_tokens: 300,
        temperature: 0.3,
      });

      return this.streamToAsyncIterable(stream);
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async* streamToAsyncIterable(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  getBufferSize(): number {
    return this.logBuffer.length;
  }
}
