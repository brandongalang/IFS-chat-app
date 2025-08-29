'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, User, TestTube } from 'lucide-react'
import { 
  getCurrentPersona, 
  setCurrentPersona, 
  TEST_PERSONAS,
  type TestPersona,
  developmentConfig 
} from '@/mastra/config/development'

interface PersonaSwitcherProps {
  className?: string
}

export function PersonaSwitcher({ className = '' }: PersonaSwitcherProps) {
  const [currentPersona, setCurrentPersonaState] = useState<TestPersona>('beginner')
  const [isOpen, setIsOpen] = useState(false)

  // Only render in development mode
  if (!developmentConfig.enabled) {
    return null
  }

  useEffect(() => {
    setCurrentPersonaState(getCurrentPersona())
  }, [])

  const handlePersonaChange = (newPersona: TestPersona) => {
    setCurrentPersona(newPersona)
    setCurrentPersonaState(newPersona)
    setIsOpen(false)
    
    // Refresh the page to load new persona data
    window.location.reload()
  }

  const currentConfig = TEST_PERSONAS[currentPersona]

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
        title={`Testing as: ${currentConfig.name} - ${currentConfig.description}`}
      >
        <TestTube className="w-4 h-4 text-amber-600" />
        <User className="w-4 h-4 text-amber-600" />
        <span className="text-amber-800 font-medium">
          {currentConfig.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <TestTube className="w-3 h-3" />
                Test Personas
              </div>
            </div>
            <div className="py-1">
              {Object.entries(TEST_PERSONAS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handlePersonaChange(key as TestPersona)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    currentPersona === key ? 'bg-amber-50 border-r-2 border-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <User className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      key === 'beginner' ? 'text-green-500' :
                      key === 'moderate' ? 'text-blue-500' : 'text-purple-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">
                        {config.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {config.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        ID: {config.id.split('-')[0]}...
                      </div>
                    </div>
                    {currentPersona === key && (
                      <div className="text-amber-500 text-xs font-medium">
                        ACTIVE
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-gray-100 text-xs text-gray-500">
              💡 Persona data persists in localStorage. Switching will refresh the page.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PersonaSwitcher
