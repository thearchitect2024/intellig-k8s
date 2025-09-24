#!/bin/bash

# IntelliG K8s - Quick Start Demo Script
# This script starts the application in demo mode for easy testing

set -e

echo "🚀 Starting IntelliG K8s Demo..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Set demo environment variables
export MODEL_API_KEY="demo-key"
export NODE_ENV="development"
export PORT="3001"

echo "🎮 Demo Mode Configuration:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend:  http://localhost:3001"
echo "  • AI Features: Simulated (no API key required)"
echo ""

echo "📋 Demo Features:"
echo "  • Simulated Kubernetes clusters and pods"
echo "  • Live log streaming with realistic scenarios"
echo "  • AI analysis with mock responses"
echo "  • Full UI functionality without AWS/K8s setup"
echo ""

echo "🎯 To get started:"
echo "  1. Wait for both servers to start"
echo "  2. Open http://localhost:5173 in your browser"
echo "  3. Toggle 'Demo Mode' ON in the setup page"
echo "  4. Click 'Start Demo' to begin"
echo ""

echo "⌨️  Keyboard shortcuts in the logs view:"
echo "  • P - Pause/Resume streaming"
echo "  • / - Focus filter input"
echo "  • Ctrl+E - Export logs"
echo "  • Ctrl+K - Clear logs"
echo ""

echo "Starting servers..."
npm run dev
