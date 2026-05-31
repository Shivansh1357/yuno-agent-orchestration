import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { MetaProvider } from './MetaContext'
import '@xyflow/react/dist/style.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <MetaProvider>
          <App />
        </MetaProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>,
)
