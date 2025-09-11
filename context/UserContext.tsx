'use client'

import { createContext, useContext, type ReactNode } from 'react';

export interface UserProfile {
  name: string;
  bio: string;
}

export interface User {
  id: string;
  profile: UserProfile;
}

const UserContext = createContext<User | null>(null);

interface ProviderProps {
  value: User;
  children: ReactNode;
}

export function UserProvider({ value, children }: ProviderProps) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): User {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
