import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Uncaught Error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.reload()
    }
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Something went wrong rendering this component.'
      const errorStack = this.state.error?.stack || ''
      const componentStack = this.state.errorInfo?.componentStack || ''

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800">
          <div className="max-w-lg w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center text-xl font-bold">
              ⚠
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">An interface error occurred</h2>
              <p className="text-xs text-slate-600 mt-1 font-mono bg-rose-50/70 p-2 rounded-lg border border-rose-100 text-rose-900 break-words">
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Reload Component
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Return to Safe Dashboard
              </button>
            </div>

            {(errorStack || componentStack) && (
              <div className="pt-3 border-t border-slate-100 text-left">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer underline flex items-center gap-1 mx-auto"
                >
                  {this.state.showDetails ? '▲ Hide Diagnostics' : '▼ View Technical Diagnostics'}
                </button>
                {this.state.showDetails && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono overflow-auto max-h-48 whitespace-pre-wrap select-all">
                    {errorStack && <div><strong>Error Stack:</strong>{'\n'}{errorStack}</div>}
                    {componentStack && <div className="mt-2"><strong>Component Stack:</strong>{'\n'}{componentStack}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

