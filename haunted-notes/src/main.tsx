import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/registerSw.ts'
import { recoverSnapshot } from './lib/demoSnapshot.ts'
import { useStore } from './store/useStore.ts'

// A Run demo that was cut short (tab closed) leaves its snapshot behind:
// put the user's data back before anything renders.
try {
  recoverSnapshot(window.localStorage, (snapshot) => useStore.setState(snapshot))
} catch (err) {
  console.warn('Haunted Notes: could not check for an interrupted demo', err)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
