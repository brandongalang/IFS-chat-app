'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { LogoutButton } from '@/components/auth/logout-button'
import { isPromptInjection } from '@/lib/security'
import { isNewUIEnabled } from '@/config/features'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Image from 'next/image'
import Link from 'next/link'

export default function ProfileClient() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const newUI = isNewUIEnabled()

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        setEmail(user.email || '')
        const { data: userData, error } = await supabase
          .from('users')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user profile', error)
        } else if (userData) {
          setName(userData.name || '')
          setAvatarUrl(userData.avatar_url || '')
        }
      }
      setLoading(false)
    }

    fetchProfile()
  }, [supabase])

  const [saving, setSaving] = useState(false)

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${user?.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setAvatarUrl(data.publicUrl)
    } catch (error: unknown) {
      alert('Error uploading avatar: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  const [injectionAttempt, setInjectionAttempt] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setInjectionAttempt(false)

    const isInjection = await isPromptInjection(name)
    if (isInjection) {
      setInjectionAttempt(true)
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('users')
      .update({ name: name, avatar_url: avatarUrl })
      .eq('id', user.id)

    if (error) {
      alert('Error updating profile: ' + error.message)
    } else {
      alert('Profile saved successfully!')
    }
    setSaving(false)
  }

  if (newUI) {
    return (
      <div className="min-h-screen bg-[var(--hs-bg)] flex flex-col hs-animate-in">
        {/* Header */}
        <header className="flex items-center px-4 py-3 sticky top-0 z-10 bg-[var(--hs-bg)]/95 backdrop-blur-md border-b border-[var(--hs-border-subtle)]">
          <Link
            href="/settings"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
            aria-label="Go back"
          >
            <MaterialIcon name="arrow_back" />
          </Link>
          <h1 className="flex-1 text-center text-lg font-semibold text-[var(--hs-text-primary)]">
            Profile
          </h1>
          <div className="w-10" />
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-[var(--hs-text-tertiary)]">Loading...</div>
          </div>
        ) : (
          <main className="flex-1 px-5 py-6 space-y-6 max-w-lg mx-auto w-full">
            {/* Avatar Section */}
            <section className="flex flex-col items-center">
              <div className="relative mb-4">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-[var(--hs-border-subtle)]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[var(--hs-primary-muted)] ring-4 ring-[var(--hs-border-subtle)] flex items-center justify-center">
                    <MaterialIcon
                      name="person"
                      className="text-4xl text-[var(--hs-primary)]"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--hs-primary)] text-white flex items-center justify-center shadow-md hover:bg-[var(--hs-primary-dark)] transition-colors"
                >
                  <MaterialIcon name="edit" className="text-base" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={uploadAvatar}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              {uploading && (
                <p className="text-sm text-[var(--hs-text-tertiary)]">Uploading...</p>
              )}
            </section>

            {/* Form Section */}
            <section className="hs-card p-5 space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-[var(--hs-text-secondary)]"
                >
                  Name
                </Label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="hs-input"
                  placeholder="Your name"
                />
                {injectionAttempt && (
                  <p className="text-red-500 text-sm">
                    Please use a different name.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-[var(--hs-text-secondary)]"
                >
                  Email
                </Label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="hs-input opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-[var(--hs-text-tertiary)]">
                  Email cannot be changed
                </p>
              </div>
            </section>

            {/* Actions */}
            <section className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="hs-btn-primary w-full disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <LogoutButton className="hs-btn-secondary w-full" />
            </section>
          </main>
        )}
      </div>
    )
  }

  // Original UI
  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
      </div>
      <div className="border-t border-border/40 my-4" />
      <div className="space-y-8 max-w-2xl mx-auto py-8">
        <div className="grid gap-4">
          <Label>Profile Picture</Label>
          <div className="flex items-center gap-6">
            <div className="relative">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="rounded-full object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                  <span className="text-white/60 text-sm">No Image</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={uploadAvatar}
                accept="image/*"
                className="hidden"
              />
              <p className="text-xs text-white/60">JPG, PNG up to 2MB</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} disabled />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {injectionAttempt && (
            <p className="text-red-500 text-sm mt-2">
              Potential prompt injection detected. Please use a different name.
            </p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
