import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="error-boundary card" role="alert">
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-message">
            We couldn’t load this part of the page. Please try again or go back to the dashboard.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="error-boundary-stack">{this.state.error.message}</pre>
          )}
          <div className="error-boundary-actions">
            <button
              type="button"
              className="btn"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
            <Link to="/" className="btn btn-outline">
              Back to dashboard
            </Link>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
