export interface SwEnv {
  prod: boolean
  hasServiceWorker: boolean
  secure: boolean
}

/** Registration is allowed only in production builds, with worker support, in a secure context. */
export function shouldRegisterSw(env: SwEnv): boolean {
  return env.prod && env.hasServiceWorker && env.secure
}

/** The browser objects registerServiceWorker needs; injectable for tests. */
export interface SwRuntime {
  env: SwEnv
  baseURI: string
  addLoadListener: (listener: () => void) => void
  register: (url: string, options: RegistrationOptions) => Promise<unknown>
  warn: (message: string) => void
}

function browserRuntime(): SwRuntime {
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  return {
    env: {
      prod: import.meta.env.PROD,
      hasServiceWorker,
      secure: typeof isSecureContext !== 'undefined' && isSecureContext,
    },
    baseURI: document.baseURI,
    addLoadListener: (listener) => {
      if (document.readyState === 'complete') listener()
      else window.addEventListener('load', listener, { once: true })
    },
    register: (url, options) => navigator.serviceWorker.register(url, options),
    warn: (message) => console.warn(message),
  }
}

export function registerServiceWorker(runtime?: SwRuntime): void {
  const rt = runtime ?? browserRuntime()
  if (!shouldRegisterSw(rt.env)) return
  rt.addLoadListener(() => {
    const url = new URL('sw.js', rt.baseURI).href
    const scope = new URL('./', rt.baseURI).pathname
    try {
      rt.register(url, { scope, updateViaCache: 'none' }).catch(() => {
        rt.warn('Service worker registration failed')
      })
    } catch {
      rt.warn('Service worker registration failed')
    }
  })
}
