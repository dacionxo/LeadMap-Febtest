'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Loader2, X, Minus, Bookmark } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useApp } from '@/app/providers'
import { add_to_list } from '../utils/listUtils'

interface SaveButtonProps {
  listing: {
    listing_id?: string
    property_url?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
    agent_name?: string | null
    agent_email?: string | null
    agent_phone?: string | null
    list_price?: number | null
  }
  saved?: boolean
  onSaved?: () => void
  onUnsaved?: () => void
  variant?: 'default' | 'compact' | 'icon'
  listId?: string // Optional list ID to add to specific list
}

export default function SaveButton({ listing, saved = false, onSaved, onUnsaved, variant = 'default', listId }: SaveButtonProps) {
  const { profile } = useApp()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(saved)
  const [error, setError] = useState<string | null>(null)

  // Sync isSaved state with saved prop
  useEffect(() => {
    setIsSaved(saved)
  }, [saved])


  const handleToggleSave = async () => {
    if (!profile?.id) {
      alert('Please log in to save listings')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const sourceId = listing.listing_id || listing.property_url

      if (!sourceId) {
        throw new Error('Invalid listing: missing listing_id or property_url')
      }

      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', profile.id)
        .eq('source', 'listing')
        .eq('source_id', sourceId)
        .maybeSingle()

      if (existingContact) {
        // Remove from saved (delete contact)
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .eq('id', existingContact.id)
          .eq('user_id', profile.id)

        if (deleteError) {
          throw deleteError
        }

        // Also remove from lists if in any
        if (listId) {
          await supabase
            .from('list_items')
            .delete()
            .eq('list_id', listId)
            .eq('item_type', 'listing')
            .eq('item_id', sourceId)
        }

        setIsSaved(false)
        
        // Call the callback to refresh the list
        if (onUnsaved) {
          await onUnsaved()
        }
      } else {
        // Double-check if already saved (prevent duplicate saves)
        const { data: doubleCheck } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', profile.id)
          .eq('source', 'listing')
          .eq('source_id', sourceId)
          .maybeSingle()
        
        if (doubleCheck) {
          // Already saved, don't save again
          setIsSaved(true)
          setError('This listing is already saved')
          setTimeout(() => setError(null), 3000)
          return
        }
        
        // Save listing
        await add_to_list(supabase, profile.id, sourceId, listing, listId)
        setIsSaved(true)
        
        // Call the callback to refresh the list
        if (onSaved) {
          await onSaved()
        }
      }
    } catch (error: any) {
      console.error('Error toggling save status:', error)
      setError(error.message || 'Failed to save')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggleSave}
        disabled={loading}
        className="p-2 rounded-lg transition-colors disabled:opacity-50"
        title={isSaved ? 'Unsave' : error ? error : 'Save'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
        ) : isSaved ? (
          <Bookmark className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-current" />
        ) : error ? (
          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
        ) : (
          <Bookmark className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
        )}
      </button>
    )
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleToggleSave}
        disabled={loading}
        className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
        title={isSaved ? 'Unsave' : error ? error : 'Save'}
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{isSaved ? 'Unsaving...' : 'Saving...'}</span>
          </>
        ) : isSaved ? (
          <>
            <Bookmark className="w-3 h-3 fill-current" />
            <span>Saved</span>
          </>
        ) : error ? (
          <>
            <X className="w-3 h-3" />
            <span>{error}</span>
          </>
        ) : (
          <>
            <Bookmark className="w-3 h-3" />
            <span>Save</span>
          </>
        )}
      </button>
    )
  }


  if (error) {
    return (
      <button
        onClick={handleToggleSave}
        className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
      >
        <X className="w-4 h-4" />
        <span>{error}</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleToggleSave}
      disabled={loading}
      className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Saving...</span>
        </>
      ) : (
        <>
          <Bookmark className="w-4 h-4" />
          <span>Save</span>
        </>
      )}
    </button>
  )
}

