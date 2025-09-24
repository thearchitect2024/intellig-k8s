export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  profile?: string;
}

export interface K8sContext {
  region?: string;
  clusterName?: string;
  credentials?: AWSCredentials;
  kubeconfig?: string;
}

export interface LogStreamOptions {
  namespace: string;
  pod: string;
  container: string;
  since?: string;
  tailLines?: number;
  regex?: string;
  follow?: boolean;
}

export interface AIAnalysisRequest {
  meta: {
    cluster?: string;
    namespace: string;
    pod: string;
    container: string;
  };
  recentLogChunk: string;
  question?: string;
}

export interface EKSCluster {
  name: string;
  status: string;
  endpoint?: string;
  version?: string;
  createdAt?: Date;
}

export interface K8sResource {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  createdAt?: Date;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  level?: string;
  source?: string;
}
