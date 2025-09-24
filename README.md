# IntelliG K8s

A lightweight, production-grade web app that streams **live Kubernetes pod logs** and provides **real-time AI explanations** while pods boot or restart. Built for fast startup, minimal resource usage, and excellent user experience.

![IntelliG K8s Demo](https://via.placeholder.com/800x400/1e293b/ffffff?text=IntelliG+K8s+Demo)

## ✨ Features

### 🔄 Live Log Streaming
- **Real-time log tailing** with WebSocket streaming
- **Virtualized display** for handling thousands of log lines
- **Smart filtering** with regex support
- **Auto-scroll** with pause/resume controls
- **Export capabilities** (text/JSON formats)

### 🤖 AI-Powered Analysis
- **Real-time AI explanations** as logs stream in
- **Pattern recognition** for common Kubernetes issues
- **Confidence-based diagnosis** with probable causes
- **Actionable suggestions** with concrete kubectl commands
- **Interactive chat** for follow-up questions

### ☁️ AWS/EKS Integration
- **Multiple auth methods**: Access keys, profiles, SSO, IRSA
- **Cluster discovery** with status indicators
- **In-memory kubeconfig** generation (no disk persistence)
- **Security-first**: No credential storage, automatic redaction

### 🎯 Smart Resource Navigation
- **Hierarchical selection**: Cluster → Namespace → Pod → Container
- **Label selector support** for pod filtering
- **Search functionality** across resources
- **Status indicators** for pod health

### 🎨 Modern UX
- **Clean, Apple-inspired design** with dark/light themes
- **Keyboard shortcuts** for power users
- **Responsive layout** with collapsible panes
- **Accessibility-focused** with proper contrast and navigation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- AWS credentials (for EKS) or existing kubeconfig

### 1. Installation

```bash
git clone <repository-url>
cd intellig-k8s
npm install
```

### 2. Configuration

Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` with your settings:
```bash
# AI Model Configuration (required for AI features)
MODEL_API_KEY=your_openai_api_key_here
MODEL_PROVIDER=openai
MODEL_NAME=gpt-4

# Server Configuration
PORT=3001
NODE_ENV=development

# AWS Configuration (optional - can also provide via UI)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-west-2
```

### 3. Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

### 4. Production Build

```bash
npm run build
npm start
```

## 🎮 Demo Mode

Try the app without AWS/Kubernetes setup:

1. Open `http://localhost:5173`
2. Toggle **Demo Mode** on the setup page
3. Click **Start Demo**
4. Experience simulated pod logs with AI analysis

Demo scenarios include:
- Normal application startup
- ImagePullBackOff errors
- OOMKilled containers
- Readiness probe failures

## 📖 Usage Guide

### Connecting to AWS/EKS

#### Option 1: AWS Credentials
1. Navigate to the **AWS** tab
2. Enter your AWS Access Key ID and Secret Access Key
3. Select your AWS region
4. Click **Discover EKS Clusters**
5. Choose your cluster from the list

#### Option 2: Kubeconfig
1. Navigate to the **Kubeconfig** tab
2. Paste your kubeconfig YAML content
3. Click **Connect with Kubeconfig**

### Viewing Logs

1. **Select Resources**: Choose namespace → pod → container
2. **Configure Stream**: Set time range (1m, 5m, 1h, etc.)
3. **Add Filters**: Use regex patterns to filter logs
4. **Start Streaming**: Click the Play button
5. **Monitor AI Analysis**: Watch real-time explanations in the right pane

### Keyboard Shortcuts

| Shortcut | Action |
|----------|---------|
| `P` | Pause/Resume log stream |
| `/` | Focus filter input |
| `Ctrl+E` | Export logs |
| `Ctrl+K` | Clear log buffer |

### AI Analyst Features

The AI analyst automatically:
- **Analyzes log patterns** as they stream
- **Identifies common issues** (ImagePullBackOff, OOMKilled, etc.)
- **Suggests kubectl commands** for investigation
- **Provides confidence percentages** for diagnoses
- **Responds to follow-up questions**

Example AI responses:
```
🔍 Analysis: ImagePullBackOff detected

Probable Causes:
• Invalid image tag (85% confidence)
• Registry authentication failure (10% confidence)
• Network connectivity issue (5% confidence)

Next Steps:
• kubectl describe pod <pod> -n <namespace>
• kubectl get events -n <namespace>
• Verify image exists in registry
```

## 🏗️ Architecture

### Backend (Node.js + Fastify)
- **FastAPI-style routing** with TypeScript
- **WebSocket streaming** for real-time logs
- **Kubernetes client** with AWS EKS integration
- **OpenAI integration** for log analysis
- **Memory-only credential handling**

### Frontend (React + Vite)
- **Modern React** with TypeScript and hooks
- **Tailwind CSS** with shadcn/ui components
- **Virtualized scrolling** for performance
- **WebSocket client** with reconnection logic
- **Theme system** with system preference detection

### Security Features
- **No credential persistence** (memory-only)
- **Automatic secret redaction** in logs and UI
- **CORS protection** with configurable origins
- **Input validation** and sanitization

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MODEL_API_KEY` | OpenAI API key for AI features | Required |
| `MODEL_PROVIDER` | AI provider (openai) | openai |
| `MODEL_NAME` | Model name | gpt-4 |
| `PORT` | Backend server port | 3001 |
| `NODE_ENV` | Environment | development |
| `AWS_ACCESS_KEY_ID` | AWS access key (optional) | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (optional) | - |
| `AWS_REGION` | Default AWS region | us-west-2 |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:5173 |

### AWS Authentication Methods

1. **UI Credentials**: Enter directly in the app (most secure)
2. **Environment Variables**: Set AWS_* variables
3. **AWS Profile**: Use `~/.aws/credentials` profiles
4. **IAM Roles**: IRSA when running in EKS
5. **SSO**: AWS SSO when configured

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
- Ensure your kubeconfig is valid
- Check network connectivity to cluster
- Verify RBAC permissions for log access

**AI Features Not Working**
- Set `MODEL_API_KEY` in environment
- Check OpenAI API key validity
- Ensure sufficient API quota

**WebSocket Connection Failed**
- Check firewall settings
- Verify proxy configuration
- Try refreshing the browser

**High Memory Usage**
- Reduce log retention (default: 10k lines)
- Use more specific log filters
- Pause streaming when not actively monitoring

### Performance Tips

- **Use label selectors** to reduce pod lists
- **Apply regex filters** at the server level
- **Pause streaming** when scrolling through history
- **Close unused browser tabs** to free memory

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Kubernetes community** for excellent APIs and documentation
- **OpenAI** for powerful language models
- **shadcn/ui** for beautiful, accessible components
- **Fastify** and **React** teams for solid foundations

---

**Built with ❤️ for Kubernetes operators and SREs**