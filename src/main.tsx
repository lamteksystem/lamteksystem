import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ImpersonationProvider } from '@/contexts/ImpersonationContext'
import { CustomerUiProvider } from '@/contexts/CustomerUiContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import App from './App'
import './index.css'
import './styles/marketing-refresh.css'
import './styles/admin-refresh.css'
import './styles/tealbury-workbench.css'
import './styles/catalog-picker.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter
        basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}
        future={{
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
