// Deprecated: Custom Google Identity Services-based auth flow.
// This module is no longer used now that the app uses supabase.auth.signInWithOAuth.
// Keeping a minimal stub to avoid breaking imports; safe to delete if unused.

export function useGoogleAuth() {
  return {
    initGoogleButton: async () => {},
    signInWithGoogle: async () => {},
    isLoading: false,
    error: null as string | null,
  }
}
