import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { AppRoutes } from '@/routes/AppRoutes'
import ErrorBoundary from '@/components/common/ErrorBoundary'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Toaster richColors position="top-right" closeButton />
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
