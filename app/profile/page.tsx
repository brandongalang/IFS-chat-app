'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

// #region Proposing Next Steps for Full Integration
// The following is a mock implementation. For a full integration, you would:
// 1. Create a `profiles` table in Supabase with columns for `id` (matching `auth.users`), `name`, `bio`, and `avatar_url`.
// 2. Implement Row Level Security (RLS) policies to ensure users can only access their own profile.
// 3. Use the Supabase client to fetch the user's profile data.
//
// Example of fetching data:
//
// import { createClient } from '@/lib/supabase/client'
// import { useEffect, useState } from 'react'
//
// const supabase = createClient()
// const [profile, setProfile] = useState(null)
//
// useEffect(() => {
//   const fetchProfile = async () => {
//     const { data: { user } } = await supabase.auth.getUser()
//     if (user) {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', user.id)
//         .single()
//       if (error) console.error('Error fetching profile', error)
//       else setProfile(data)
//     }
//   }
//   fetchProfile()
// }, [])
// #endregion

// Mock user data - in a real app, this would come from a database
const mockUser = {
  name: 'Alex',
  bio: 'Exploring the inner world, one part at a time.',
  avatarUrl: 'https://github.com/shadcn.png',
}

export default function ProfilePage() {
  const [name, setName] = useState(mockUser.name)
  const [bio, setBio] = useState(mockUser.bio)
  const [avatarUrl, setAvatarUrl] = useState(mockUser.avatarUrl)

  const handleSave = async () => {
    // #region Proposing Next Steps for Full Integration
    // In a real app, you would save this data to your backend (e.g., Supabase)
    //
    // Example of saving data:
    //
    // const supabase = createClient()
    // const { data: { user } } = await supabase.auth.getUser()
    // if (user) {
    //   const { error } = await supabase
    //     .from('profiles')
    //     .update({ name, bio, avatar_url: avatarUrl })
    //     .eq('id', user.id)
    //   if (error) alert('Error updating profile: ' + error.message)
    //   else alert('Profile saved successfully!')
    // }
    // #endregion

    console.log('Saving profile:', { name, bio, avatarUrl })
    alert('Profile saved! (Check the console for the data)')
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
      </div>
      <Separator />
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="avatar-url">Profile Picture URL</Label>
            <Input
              id="avatar-url"
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/your-image.png"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us a little about yourself"
            className="min-h-[100px]"
          />
        </div>

        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  )
}
