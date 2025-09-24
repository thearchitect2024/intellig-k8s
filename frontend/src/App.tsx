import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import SetupPage from './pages/SetupPage'
import LogsPage from './pages/LogsPage'
import { ThemeProvider } from './components/ThemeProvider'

interface AppState {
  isConfigured: boolean
  context: any
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    isConfigured: false,
    context: null
  })

  // Check if we have a saved context
  useEffect(() => {
    const savedContext = localStorage.getItem('k8s-context')
    if (savedContext) {
      try {
        const context = JSON.parse(savedContext)
        setAppState({
          isConfigured: true,
          context
        })
      } catch (error) {
        console.error('Failed to parse saved context:', error)
        localStorage.removeItem('k8s-context')
      }
    }
  }, [])

  const handleContextSet = (context: any) => {
    localStorage.setItem('k8s-context', JSON.stringify(context))
    setAppState({
      isConfigured: true,
      context
    })
  }

  const handleReset = () => {
    localStorage.removeItem('k8s-context')
    setAppState({
      isConfigured: false,
      context: null
    })
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="intellig-k8s-theme">
      <div className="min-h-screen bg-background">
        <Routes>
          <Route 
            path="/setup" 
            element={
              <SetupPage 
                onContextSet={handleContextSet}
                initialContext={appState.context}
              />
            } 
          />
          <Route 
            path="/logs" 
            element={
              appState.isConfigured ? 
                <LogsPage 
                  context={appState.context}
                  onReset={handleReset}
                /> : 
                <Navigate to="/setup" replace />
            } 
          />
          <Route 
            path="/" 
            element={
              <Navigate 
                to={appState.isConfigured ? "/logs" : "/setup"} 
                replace 
              />
            } 
          />
        </Routes>
      </div>
    </ThemeProvider>
  )
}

export default App
