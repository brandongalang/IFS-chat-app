'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface UpgradeModalContextType {
  isOpen: boolean
  openModal: (title: string, description: string) => void
  closeModal: () => void
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(undefined)

export const useUpgradeModal = () => {
  const context = useContext(UpgradeModalContext)
  if (!context) {
    throw new Error('useUpgradeModal must be used within an UpgradeModalProvider')
  }
  return context
}

interface UpgradeModalProviderProps {
  children: ReactNode
}

export const UpgradeModalProvider = ({ children }: UpgradeModalProviderProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('Upgrade to Premium')
  const [description, setDescription] = useState(
    'You have reached your limit. Please upgrade to continue.'
  )

  const openModal = (newTitle: string, newDescription: string) => {
    setTitle(newTitle)
    setDescription(newDescription)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
  }

  return (
    <UpgradeModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeModal}>Cancel</AlertDialogCancel>
            <Link href="/pricing" passHref>
              <AlertDialogAction asChild>
                <Button>Upgrade</Button>
              </AlertDialogAction>
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UpgradeModalContext.Provider>
  )
}
