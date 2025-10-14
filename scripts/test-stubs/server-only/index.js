const shouldBypass = process.env.SERVER_ONLY_DISABLE_GUARD === 'true' || process.env.NODE_ENV === 'test'

if (!shouldBypass) {
  throw new Error(
    'This module cannot be imported from a Client Component module. It should only be used from a Server Component.'
  )
}

module.exports = {}
