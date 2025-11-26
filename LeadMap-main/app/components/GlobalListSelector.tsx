'use client'

import { usePageState } from '@/app/contexts/PageStateContext'
import { useApp } from '@/app/providers'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useTheme } from '@/components/ThemeProvider'
import ListSelectorModal from './ListSelectorModal'
import { useCallback } from 'react'
import { normalizeListingIdentifier } from '@/app/dashboard/lists/utils/identifierUtils'

export default function GlobalListSelector() {
  const { 
    showListSelector, 
    listSelectorContext, 
    closeListSelector,
    clearSelection 
  } = usePageState()
  const { profile } = useApp()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const supabase = createClientComponentClient()

  const handleSelectList = useCallback(async (listId: string, listName: string) => {
    if (!listSelectorContext || !profile?.id) return

    try {
      const listingIds = listSelectorContext.listingIds || []
      
      if (listingIds.length === 0) {
        throw new Error('No items to add')
      }

      // Use the new API endpoint for bulk add (Apollo-grade)
      const items = listingIds
        .map(listingId => {
          const normalizedId = normalizeListingIdentifier(listingId)
          if (!normalizedId) {
            console.warn(`⚠️ Skipping invalid listing ID: ${listingId}`)
            return null
          }
          return {
            itemId: normalizedId,
            itemType: 'listing' as const
          }
        })
        .filter((item): item is { itemId: string; itemType: 'listing' } => item !== null)

      if (items.length === 0) {
        throw new Error('No valid items to add after normalization')
      }

      // Use bulk-add API endpoint
      const response = await fetch('/api/lists/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listIds: [listId],
          items: items
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add items to list')
      }

      // Clear selection after successful add
      clearSelection()

      // Show success message (you can replace this with a toast notification)
      if (typeof window !== 'undefined') {
        const count = listingIds.length
        alert(`Successfully added ${count} item${count > 1 ? 's' : ''} to "${listName}"`)
      }
    } catch (error: any) {
      console.error('Error in handleSelectList:', error)
      throw error
    }
  }, [listSelectorContext, profile?.id, supabase, clearSelection])

  const handleCreateNewList = useCallback(async (name: string): Promise<string> => {
    if (!profile?.id) {
      throw new Error('User not authenticated')
    }

    try {
      // Use the new API endpoint
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type: 'properties', // Default for backward compatibility
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create list')
      }

      return data.list.id
    } catch (error: any) {
      console.error('Error in handleCreateNewList:', error)
      throw error
    }
  }, [profile?.id])

  if (!showListSelector || !listSelectorContext) {
    return null
  }

  const listingIds = listSelectorContext.listingIds || []

  return (
    <ListSelectorModal
      isOpen={showListSelector}
      onClose={closeListSelector}
      onSelect={handleSelectList}
      onCreateNew={handleCreateNewList}
      listingIds={listingIds}
      isDark={isDark}
    />
  )
}

