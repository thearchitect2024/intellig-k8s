import * as k8s from '@kubernetes/client-node';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
// Credential providers available but not used in this implementation
import { AWSCredentials, K8sContext, EKSCluster } from '../types.js';

export class K8sClientManager {
  private k8sApi: k8s.CoreV1Api | null = null;
  private k8sConfig: k8s.KubeConfig | null = null;
  private currentContext: K8sContext | null = null;

  async setContext(context: K8sContext): Promise<void> {
    this.currentContext = context;
    
    if (context.kubeconfig) {
      // Use provided kubeconfig
      this.k8sConfig = new k8s.KubeConfig();
      this.k8sConfig.loadFromString(context.kubeconfig);
    } else if (context.clusterName && context.region) {
      // Create kubeconfig from EKS cluster info
      this.k8sConfig = await this.createEKSKubeConfig(context);
    } else {
      throw new Error('Either kubeconfig or EKS cluster info (clusterName + region) must be provided');
    }
    
    this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api);
  }

  private async createEKSKubeConfig(context: K8sContext): Promise<k8s.KubeConfig> {
    if (!context.clusterName || !context.region) {
      throw new Error('Cluster name and region are required for EKS');
    }

    // Create EKS client with provided credentials or default provider chain
    const eksClient = new EKSClient({
      region: context.region,
      credentials: context.credentials ? {
        accessKeyId: context.credentials.accessKeyId,
        secretAccessKey: context.credentials.secretAccessKey,
        sessionToken: context.credentials.sessionToken,
      } : undefined, // Will use default provider chain if not provided
    });

    // Get cluster info
    const command = new DescribeClusterCommand({ name: context.clusterName });
    const response = await eksClient.send(command);
    
    if (!response.cluster?.endpoint || !response.cluster?.certificateAuthority?.data) {
      throw new Error('Invalid cluster response from EKS');
    }

    // Create kubeconfig object
    const kubeConfig = new k8s.KubeConfig();
    
    const clusterConfig = {
      name: context.clusterName,
      server: response.cluster.endpoint,
      'certificate-authority-data': response.cluster.certificateAuthority.data,
    };

    const userConfig = {
      name: `${context.clusterName}-user`,
      exec: {
        apiVersion: 'client.authentication.k8s.io/v1beta1',
        command: 'aws',
        args: [
          'eks',
          'get-token',
          '--cluster-name',
          context.clusterName,
          '--region',
          context.region,
        ],
      },
    };

    const contextConfig = {
      name: context.clusterName,
      cluster: context.clusterName,
      user: `${context.clusterName}-user`,
    };

    // Build kubeconfig manually
    const kubeConfigObj = {
      apiVersion: 'v1',
      kind: 'Config',
      clusters: [{ name: clusterConfig.name, cluster: clusterConfig }],
      users: [{ name: userConfig.name, user: userConfig }],
      contexts: [{ name: contextConfig.name, context: contextConfig }],
      'current-context': contextConfig.name,
    };

    kubeConfig.loadFromString(JSON.stringify(kubeConfigObj));
    return kubeConfig;
  }

  async listEKSClusters(region: string, credentials?: AWSCredentials): Promise<EKSCluster[]> {
    const eksClient = new EKSClient({
      region,
      credentials: credentials ? {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      } : undefined,
    });

    try {
      // Import ListClustersCommand dynamically to avoid import issues
      const { ListClustersCommand } = await import('@aws-sdk/client-eks');
      const listCommand = new ListClustersCommand({});
      const { clusters } = await eksClient.send(listCommand);
      
      if (!clusters) return [];

      // Get detailed info for each cluster
      const clusterDetails = await Promise.all(
        clusters.map(async (clusterName: string) => {
          try {
            const command = new DescribeClusterCommand({ name: clusterName });
            const response = await eksClient.send(command);
            const cluster = response.cluster;
            
            return {
              name: clusterName,
              status: cluster?.status || 'UNKNOWN',
              endpoint: cluster?.endpoint,
              version: cluster?.version,
              createdAt: cluster?.createdAt,
            };
          } catch (error) {
            console.error(`Error describing cluster ${clusterName}:`, error);
            return {
              name: clusterName,
              status: 'ERROR',
            };
          }
        })
      );

      return clusterDetails;
    } catch (error) {
      console.error('Error listing EKS clusters:', error);
      throw new Error(`Failed to list EKS clusters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testAWSCredentials(credentials: AWSCredentials): Promise<boolean> {
    try {
      const eksClient = new EKSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      });

      // Simple test - list clusters
      const { ListClustersCommand } = await import('@aws-sdk/client-eks');
      const listCommand = new ListClustersCommand({});
      await eksClient.send(listCommand);
      return true;
    } catch (error) {
      console.error('AWS credentials test failed:', error);
      return false;
    }
  }

  getApi(): k8s.CoreV1Api {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized. Call setContext first.');
    }
    return this.k8sApi;
  }

  getConfig(): k8s.KubeConfig {
    if (!this.k8sConfig) {
      throw new Error('Kubernetes config not initialized. Call setContext first.');
    }
    return this.k8sConfig;
  }

  getCurrentContext(): K8sContext | null {
    return this.currentContext;
  }
}
