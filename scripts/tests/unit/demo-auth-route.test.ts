export {}

type AdminApiStub = {
  listUsersCalls: string[]
  createUserCalls: Array<{ email: string; password: string }>
  updateUserCalls: Array<{ id: string; password: string }>
  shouldFailLookup: boolean
  shouldFailCreate: boolean
  userExists: boolean
}

type UserAuthStub = {
  signInCalls: Array<{ email: string; password: string }>
  setSessionCalls: Array<{ access_token: string; refresh_token: string }>
  shouldFailSignIn: boolean
  shouldFailSetSession: boolean
}

function createAdminApiStub(): AdminApiStub & {
  listUsers: (input: { page?: number; perPage?: number }) => Promise<{ data: any; error: Error | null }>
  createUser: (input: { email: string; password: string }) => Promise<{ data: any; error: Error | null }>
  updateUserById: (id: string, input: { password: string }) => Promise<{ data: any; error: Error | null }>
} {
  const state: AdminApiStub = {
    listUsersCalls: [],
    createUserCalls: [],
    updateUserCalls: [],
    shouldFailLookup: false,
    shouldFailCreate: false,
    userExists: false,
  }

  return Object.assign(state, {
    async listUsers() {
      state.listUsersCalls.push('called')
      if (state.shouldFailLookup) {
        return { data: null, error: new Error('lookup failed') }
      }
      if (state.userExists) {
        return { data: { users: [{ id: 'user-123', email: 'demo@example.com' }], nextPage: null }, error: null }
      }
      return { data: { users: [], nextPage: null }, error: null }
    },
    async createUser({ email, password }: { email: string; password: string }) {
      state.createUserCalls.push({ email, password })
      if (state.shouldFailCreate) {
        return { data: null, error: new Error('create failed') }
      }
      state.userExists = true
      return {
        data: { user: { id: 'user-123', email } },
        error: null,
      }
    },
    async updateUserById(id: string, { password }: { password: string }) {
      state.updateUserCalls.push({ id, password })
      return { data: { user: { id } }, error: null }
    },
  })
}

function createUserAuthStub(): UserAuthStub & {
  signOut: () => Promise<{ error: Error | null }>
  signInWithPassword: (input: { email: string; password: string }) => Promise<{ data: any; error: Error | null }>
  setSession: (input: { access_token: string; refresh_token: string }) => Promise<{ data: any; error: Error | null }>
} {
  const state: UserAuthStub = {
    signInCalls: [],
    setSessionCalls: [],
    shouldFailSignIn: false,
    shouldFailSetSession: false,
  }

  return Object.assign(state, {
    async signOut() {
      return { error: null }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      state.signInCalls.push({ email, password })
      if (state.shouldFailSignIn) {
        return { data: { session: null }, error: new Error('sign-in failed') }
      }
      return {
        data: {
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: 'user-123', email },
          },
        },
        error: null,
      }
    },
    async setSession(input: { access_token: string; refresh_token: string }) {
      state.setSessionCalls.push(input)
      if (state.shouldFailSetSession) {
        return { data: null, error: new Error('set-session failed') }
      }
      return { data: { session: input }, error: null }
    },
  })
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  process.env.NODE_ENV = 'test'
  const envModule = await import('@/config/env')
  const supabaseClients = await import('@/lib/supabase/clients')
  const { POST } = await import('@/app/auth/demo-login/route')

  const env = envModule.env as Record<string, unknown>

  // Test case 1: Demo auth disabled returns 403
  env.ifsDemoAuthEnabled = false
  env.ifsDemoAuthEmail = null
  env.ifsDemoAuthPassword = null
  const disabledResponse = await POST()
  assert(disabledResponse.status === 403, 'Disabled demo auth should return 403')
  console.log('Test Case 1 Passed: Disabled demo auth returns 403')

  // Prepare stubs for subsequent tests
  const adminStub = createAdminApiStub()
  const userAuthStub = createUserAuthStub()

  supabaseClients.setServiceClientOverrideForTests({
    auth: {
      admin: adminStub,
    },
  } as any)

  supabaseClients.setUserClientOverrideForTests({
    auth: userAuthStub,
  } as any)

  // Test case 2: Successful demo login provisions user and sets session
  env.ifsDemoAuthEnabled = true
  env.ifsDemoAuthEmail = 'demo@example.com'
  env.ifsDemoAuthPassword = 'super-secret'

  const successResponse = await POST()
  assert(successResponse.status === 200, 'Demo auth should succeed with full configuration')
  const payload = await successResponse.json()
  assert(payload.session.access_token === 'access-token', 'Access token mismatch')
  assert(userAuthStub.signInCalls.length === 1, 'Expected a sign-in call')
  assert(userAuthStub.setSessionCalls.length === 1, 'Expected a setSession call')
  assert(
    adminStub.createUserCalls.length === 1,
    'Expected demo auth to provision the user when missing',
  )
  assert(adminStub.updateUserCalls.length === 0, 'Newly provisioned user should not trigger update')
  console.log('Test Case 2 Passed: Demo auth provisions user and returns session')

  // Test case 3: Existing user skips provisioning
  adminStub.userExists = true
  adminStub.createUserCalls.length = 0
  adminStub.updateUserCalls.length = 0

  const repeatResponse = await POST()
  assert(repeatResponse.status === 200, 'Demo auth should succeed for existing user')
  assert(adminStub.createUserCalls.length === 0, 'Existing user should not be re-created')
  assert(adminStub.updateUserCalls.length === 1, 'Existing user path should update password')
  console.log('Test Case 3 Passed: Demo auth reuses existing user')

  // Cleanup
  supabaseClients.setServiceClientOverrideForTests(null)
  supabaseClients.setUserClientOverrideForTests(null)
  env.ifsDemoAuthEnabled = false
  env.ifsDemoAuthEmail = null
  env.ifsDemoAuthPassword = null

  console.log('All demo auth route unit tests passed.')
}

main().catch((error) => {
  console.error('demo-auth-route unit test failed:', error)
  process.exit(1)
})
