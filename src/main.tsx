import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ImpersonationProvider } from '@/contexts/ImpersonationContext'
import { CustomerUiProvider } from '@/contexts/CustomerUiContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ImpersonationProvider>
          <ThemeProvider>
            <CustomerUiProvider>
              <App />
            </CustomerUiProvider>
          </ThemeProvider>
        </ImpersonationProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
