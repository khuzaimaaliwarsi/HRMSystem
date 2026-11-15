import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initStorageSynchronization } from './lib/storageSync'
import { executeCutoverCleanup } from './services/storageCutover'

// Enforce PostgreSQL Cutover: Safely purge legacy business keys from LocalStorage while preserving UI preferences
executeCutoverCleanup()

// Initialize safe cross-tab storage synchronization
initStorageSynchronization()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
