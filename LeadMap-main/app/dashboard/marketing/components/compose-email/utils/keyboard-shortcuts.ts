/**
 * Keyboard Shortcuts Utilities
 * Keyboard navigation and shortcuts for email composer
 * Following .cursorrules: TypeScript interfaces, accessibility
 */

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: (event: KeyboardEvent) => void
  description: string
}

/**
 * Common keyboard shortcuts for email composer
 */
export const COMPOSER_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 's',
    ctrl: true,
    handler: () => {
      // Trigger save draft - will be handled by component
      const event = new CustomEvent('composer:save-draft')
      window.dispatchEvent(event)
    },
    description: 'Save draft (Ctrl+S)',
  },
  {
    key: 'p',
    ctrl: true,
    handler: () => {
      // Trigger preview - will be handled by component
      const event = new CustomEvent('composer:preview')
      window.dispatchEvent(event)
    },
    description: 'Preview (Ctrl+P)',
  },
  {
    key: 'Enter',
    ctrl: true,
    handler: () => {
      // Trigger send - will be handled by component
      const event = new CustomEvent('composer:send')
      window.dispatchEvent(event)
    },
    description: 'Send email (Ctrl+Enter)',
  },
  {
    key: 'Escape',
    handler: () => {
      // Trigger cancel - will be handled by component
      const event = new CustomEvent('composer:cancel')
      window.dispatchEvent(event)
    },
    description: 'Cancel (Esc)',
  },
]

/**
 * Register keyboard shortcuts
 */
export function registerKeyboardShortcuts(shortcuts: KeyboardShortcut[]): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keyMatch = event.key === shortcut.key || event.code === shortcut.key
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault()
        shortcut.handler(event)
        break
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Check if keyboard shortcut matches event
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const keyMatch = event.key === shortcut.key || event.code === shortcut.key
  const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
  const altMatch = shortcut.alt ? event.altKey : !event.altKey

  return keyMatch && ctrlMatch && shiftMatch && altMatch
}









