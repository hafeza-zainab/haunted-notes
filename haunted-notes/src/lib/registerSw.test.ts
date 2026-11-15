import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker, shouldRegisterSw, type SwRuntime } from './registerSw'

const ok = { prod: true, hasServiceWorker: true, secure: true }

describe('shouldRegisterSw', () => {
  it('is false in dev', () => expect(shouldRegisterSw({ ...ok, prod: false })).toBe(false))
  it('is false without serviceWorker', () =>
    expect(shouldRegisterSw({ ...ok, hasServiceWorker: false })).toBe(false))
  it('is false in an insecure context', () =>
    expect(shouldRegisterSw({ ...ok, secure: false })).toBe(false))
  it('is true in production over a secure context', () => expect(shouldRegisterSw(ok)).toBe(true))
})

function fakeRuntime(register: SwRuntime['register'], env = ok) {
  const warn = vi.fn()
  const runtime: SwRuntime = {
    env,
    baseURI: 'https://example.test/app/',
    addLoadListener: (l) => l(),
    register,
    warn,
  }
  return { runtime, warn }
}

describe('registerServiceWorker', () => {
  it('registers with a relative scope and updateViaCache none', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(fakeRuntime(register).runtime)
    expect(register).toHaveBeenCalledWith('https://example.test/app/sw.js', {
      scope: '/app/',
      updateViaCache: 'none',
    })
  })

  it('does not register in dev', () => {
    const register = vi.fn().mockResolvedValue({})
    registerServiceWorker(fakeRuntime(register, { ...ok, prod: false }).runtime)
    expect(register).not.toHaveBeenCalled()
  })

  it('warns once and does not throw when registration rejects', async () => {
    const register = vi.fn().mockRejectedValue(new Error('nope'))
    const { runtime, warn } = fakeRuntime(register)
    expect(() => registerServiceWorker(runtime)).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
