export {}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  process.env.NODE_ENV = 'test'
  const envModule = await import('@/config/env')
  const demoAuth = await import('@/config/demo-auth')

  const env = envModule.env as Record<string, unknown>

  // Test Case 1: Defaults disable demo auth
  env.ifsDemoAuthEnabled = false
  env.ifsDemoAuthEmail = null
  env.ifsDemoAuthPassword = null
  env.nextPublicIfsDemoAuthEnabled = false

  assert(demoAuth.isDemoAuthEnabled() === false, 'Demo auth should be disabled by default')
  assert(demoAuth.getDemoAuthCredentials() === null, 'Credentials should be null by default')
  console.log('Test Case 1 Passed: Demo auth disabled without env overrides')

  // Test Case 2: Missing password keeps flag off
  env.ifsDemoAuthEnabled = true
  env.ifsDemoAuthEmail = 'demo@example.com'
  env.ifsDemoAuthPassword = null

  assert(
    demoAuth.isDemoAuthEnabled() === false,
    'Demo auth should remain disabled without password even if server flag is true',
  )
  console.log('Test Case 2 Passed: Missing password keeps demo auth disabled')

  // Test Case 3: Full configuration enables demo auth
  env.ifsDemoAuthEnabled = true
  env.ifsDemoAuthEmail = 'demo@example.com'
  env.ifsDemoAuthPassword = 'super-secret'
  env.nextPublicIfsDemoAuthEnabled = true

  assert(demoAuth.isDemoAuthEnabled() === true, 'Demo auth should be enabled with full configuration')
  const creds = demoAuth.requireDemoAuthCredentials()
  assert(creds.email === 'demo@example.com', 'Configured email mismatch')
  assert(creds.password === 'super-secret', 'Configured password mismatch')
  assert(demoAuth.isDemoAuthClientEnabled() === true, 'Client flag should reflect public toggle')
  console.log('Test Case 3 Passed: Demo auth enabled with full configuration')

  console.log('All demo auth config unit tests passed.')
}

main().catch((error) => {
  console.error('demo-auth-config unit test failed:', error)
  process.exit(1)
})
