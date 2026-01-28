'use client'

/**
 * DealsSelectionActionBar
 *
 * Action bar that appears when one or more deals are selected.
 * Shows a teal badge with count, action buttons, and a close button.
 *
 * Actions: Add to sequence, Duplicate, Export, Archive, Delete, Convert (disabled),
 * Move to, Sidekick, Apps.
 */

import React from 'react'
import {
  Layers,
  Copy,
  Download,
  Archive,
  Trash2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Puzzle,
  X,
} from 'lucide-react'
import { cn } from '@/app/lib/utils'

export interface DealsSelectionActionBarProps {
  selectedCount: number
  onClose: () => void
  onAddToSequence?: () => void
  onDuplicate?: () => void
  onExport?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onConvert?: () => void
  onMoveTo?: () => void
  onSidekick?: () => void
  onApps?: () => void
  isDark?: boolean
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  isDark?: boolean
}

const ActionButton = ({ icon, label, onClick, disabled = false, isDark }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex flex-col items-center justify-center gap-1 py-1.5 px-2.5',
      'rounded-md transition-colors duration-[70ms]',
      'hover:bg-[var(--primary-background-hover-color, rgba(103,104,121,0.1))]',
      'dark:hover:bg-white/10',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color,#0073ea)] focus-visible:ring-offset-2',
      disabled && 'opacity-[var(--disabled-component-opacity,0.38)] cursor-not-allowed',
      !disabled && 'cursor-pointer'
    )}
    aria-label={label}
    style={{
      color: disabled 
        ? 'var(--disabled-text-color, #9ca3af)' 
        : 'var(--primary-text-color, #323338)',
      fontFamily: 'var(--font-family, Figtree, Roboto, sans-serif)',
      fontSize: 'var(--font-size-10, 14px)',
      lineHeight: 'var(--font-line-height-10, 18px)',
      fontWeight: 'var(--font-weight-normal, 400)',
    }}
  >
    <span
      className={cn(
        'flex items-center justify-center',
        disabled 
          ? 'text-[var(--disabled-text-color, #9ca3af)]' 
          : 'text-[var(--icon-color,#676879)] dark:text-white/70'
      )}
      aria-hidden
    >
      {icon}
    </span>
    <span className="whitespace-nowrap">{label}</span>
  </button>
)

export default function DealsSelectionActionBar({
  selectedCount,
  onClose,
  onAddToSequence,
  onDuplicate,
  onExport,
  onArchive,
  onDelete,
  onConvert,
  onMoveTo,
  onSidekick,
  onApps,
  isDark = false,
}: DealsSelectionActionBarProps) {
  if (selectedCount <= 0) return null

  const label = selectedCount === 1 ? 'Deal selected' : 'Deals selected'

  return (
    <div
      role="toolbar"
      aria-label={`${selectedCount} ${label}. Actions for selected deals.`}
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-4 px-4 py-3',
        'w-full max-w-5xl mx-auto',
        'rounded-xl',
        'bg-white dark:bg-[#1c2536]',
        'border border-[var(--layout-border-color,#d0d4e4)] dark:border-white/10',
        'shadow-[var(--box-shadow-small,0px_4px_8px_rgba(0,0,0,0.2))]'
      )}
      style={{ minHeight: 'var(--spacing-xl, 32px)' }}
    >
      {/* Selection indicator: teal circle + count + label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-white flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-teal, #14b8a6)',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-20, 14px)',
            fontWeight: 'var(--font-weight-bold, 500)',
          }}
          aria-hidden
        >
          {selectedCount}
        </div>
        <span
          className="text-[var(--primary-text-color,#323338)] dark:text-white/90"
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-20, 14px)',
            lineHeight: 'var(--font-line-height-20, 24px)',
            fontWeight: 'var(--font-weight-normal, 400)',
          }}
        >
          {label}
        </span>
      </div>

      {/* Action buttons: icon + label below */}
      <div className="flex items-center gap-0.5 flex-wrap flex-1 min-w-0">
        <ActionButton
          icon={<Layers className="h-4 w-4" />}
          label="Add to sequence"
          onClick={onAddToSequence}
          isDark={isDark}
        />
        <ActionButton
          icon={<Copy className="h-4 w-4" />}
          label="Duplicate"
          onClick={onDuplicate}
          isDark={isDark}
        />
        <ActionButton
          icon={<Download className="h-4 w-4" />}
          label="Export"
          onClick={onExport}
          isDark={isDark}
        />
        <ActionButton
          icon={<Archive className="h-4 w-4" />}
          label="Archive"
          onClick={onArchive}
          isDark={isDark}
        />
        <ActionButton
          icon={<Trash2 className="h-4 w-4" />}
          label="Delete"
          onClick={onDelete}
          isDark={isDark}
        />
        <ActionButton
          icon={<RefreshCw className="h-4 w-4" />}
          label="Convert"
          onClick={onConvert}
          disabled={true}
          isDark={isDark}
        />
        <ActionButton
          icon={<ArrowRight className="h-4 w-4" />}
          label="Move to"
          onClick={onMoveTo}
          isDark={isDark}
        />
        <ActionButton
          icon={<Sparkles className="h-4 w-4" />}
          label="Sidekick"
          onClick={onSidekick}
          isDark={isDark}
        />
        <ActionButton
          icon={<Puzzle className="h-4 w-4" />}
          label="Apps"
          onClick={onApps}
          isDark={isDark}
        />
      </div>

      {/* Separator + Close */}
      <div className="flex items-center gap-3 flex-shrink-0 pl-2">
        <div
          className="w-px h-6 bg-[var(--layout-border-color,#d0d4e4)] dark:bg-white/20"
          aria-hidden
        />
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            'text-[var(--icon-color,#676879)] dark:text-white/70',
            'hover:bg-[var(--primary-background-hover-color)] dark:hover:bg-white/10',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2',
            'transition-colors duration-[70ms]'
          )}
          aria-label="Clear selection"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
