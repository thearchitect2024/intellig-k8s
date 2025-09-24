# IntelliG K8s - Setup Guide

## Quick Demo (No AWS/K8s Required)

The fastest way to try IntelliG K8s:

```bash
./start-demo.sh
```

Then open `http://localhost:5173`, toggle **Demo Mode ON**, and click **Start Demo**.

## Production Setup

### 1. Prerequisites

- **Node.js 18+** and npm
- **OpenAI API Key** (for AI analysis features)
- **AWS Credentials** (for EKS) OR **Kubeconfig** file

### 2. Installation

```bash
# Clone and install
git clone <repository-url>
cd intellig-k8s
npm install

# Copy environment template
cp env.example .env
```

### 3. Configuration

Edit `.env` with your settings:

```bash
# Required: OpenAI API Key for AI features
MODEL_API_KEY=sk-your-openai-api-key-here
MODEL_PROVIDER=openai
MODEL_NAME=gpt-4

# Optional: AWS credentials (can also provide via UI)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-west-2

# Server settings
PORT=3001
NODE_ENV=production
```

### 4. Start Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## AWS/EKS Authentication Options

### Option 1: UI Credentials (Recommended)
- Most secure - credentials never stored
- Enter AWS keys directly in the app
- Automatic cluster discovery

### Option 2: Environment Variables
Set in `.env` file:
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...  # For temporary credentials
AWS_REGION=us-west-2
```

### Option 3: AWS Profile
Use existing AWS CLI profile:
```bash
AWS_PROFILE=your-profile-name
AWS_REGION=us-west-2
```

### Option 4: IAM Role (EKS Deployment)
When running inside EKS, use IRSA (IAM Roles for Service Accounts):
```yaml
# No environment variables needed
# App will automatically use pod's IAM role
```

## Kubernetes RBAC Requirements

Your AWS user/role needs these permissions:

```yaml
# EKS Cluster Access
eks:DescribeCluster
eks:ListClusters

# Kubernetes RBAC (via kubectl or IAM)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: intellig-k8s-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "namespaces", "events"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: intellig-k8s-binding
subjects:
- kind: User
  name: your-aws-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: intellig-k8s-reader
  apiGroup: rbac.authorization.k8s.io
```

## Troubleshooting

### "Failed to connect to Kubernetes API"
1. Check your kubeconfig is valid: `kubectl cluster-info`
2. Verify network connectivity to cluster
3. Ensure proper RBAC permissions

### "AI analyst not available"
1. Set `MODEL_API_KEY` in `.env`
2. Verify OpenAI API key is valid
3. Check API quota and billing

### "WebSocket connection failed"
1. Check firewall settings (port 3001)
2. Verify proxy configuration
3. Try refreshing browser

### High memory usage
1. Use log filters to reduce data
2. Pause streaming when not needed
3. Clear log buffer regularly (Ctrl+K)

## Security Best Practices

### Credential Handling
- ✅ Use UI credential input (most secure)
- ✅ Use IAM roles when possible
- ✅ Rotate credentials regularly
- ❌ Never commit credentials to git

### Network Security
- ✅ Run behind HTTPS in production
- ✅ Configure CORS origins properly
- ✅ Use VPN/private networks
- ❌ Expose directly to internet

### Log Security
- ✅ Automatic secret redaction enabled
- ✅ No logs stored on disk
- ✅ Memory-only credential storage
- ❌ Don't disable security features

## Performance Tuning

### For Large Clusters
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Limit log retention
# (configured in UI, default 10k lines)
```

### For High Traffic
- Use label selectors to filter pods
- Apply regex filters server-side
- Consider horizontal scaling

## Deployment Options

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: intellig-k8s
spec:
  replicas: 1
  selector:
    matchLabels:
      app: intellig-k8s
  template:
    metadata:
      labels:
        app: intellig-k8s
    spec:
      serviceAccountName: intellig-k8s-sa
      containers:
      - name: app
        image: intellig-k8s:latest
        ports:
        - containerPort: 3001
        env:
        - name: MODEL_API_KEY
          valueFrom:
            secretKeyRef:
              name: intellig-k8s-secrets
              key: openai-api-key
```

## Support

- 📖 Documentation: See README.md
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions
- 🔒 Security: security@yourcompany.com
