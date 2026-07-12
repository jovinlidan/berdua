import { Component, type ReactNode } from 'react'
import { tNow } from '../lib/i18n'

interface State {
  error?: Error
}

/** Keeps a render crash from blanking the whole app — data stays safe in IndexedDB. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Berdua crashed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="berdua-bg grid min-h-screen place-items-center p-6 text-center">
          <div>
            <p className="text-5xl">🥹</p>
            <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">{tNow('Something hiccuped')}</h1>
            <p className="mt-1 text-sm text-ink-soft">{tNow('A little glitch — your memories are safe on your device.')}</p>
            <button type="button" className="btn-primary mt-5" onClick={() => window.location.reload()}>
              {tNow('Reload Berdua')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
