'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { LogoutButton } from '@/components/auth/logout-button'
import { isPromptInjection } from '@/lib/security'
import Image from 'next/image'

export default function ProfileClient() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const [injectionAttempt, setInjectionAttempt] = useState(false);

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setInjectionAttempt(false);

    const isInjection = await isPromptInjection(name);
    if (isInjection) {
      setInjectionAttempt(true);
      setSaving(false);
      return;
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
      <Separator />
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
          <Input 
            id="email" 
            type="email" 
            value={email} 
            disabled 
          />
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

