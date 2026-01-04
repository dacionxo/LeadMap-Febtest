'use client'

import { useState, useMemo } from 'react'
import { Search, X, User, Megaphone, Mail, Calendar, Tag, Copy, Check } from 'lucide-react'
import type { TokenSelectorProps, EmailToken, TokenCategory } from '../types'
import { getAllDefaultTokens, getTokensByCategory, searchTokens } from '../utils/token-definitions'
import { generateTokenString } from '../utils/token-replacement'

/**
 * Token Selector Component
 * Browser for email personalization tokens following Mautic patterns
 * Following .cursorrules: TailwindCSS, accessibility, dark mode
 */
export default function TokenSelector({
  tokens = getAllDefaultTokens(),
  categories,
  onTokenSelect,
  searchQuery: initialSearchQuery = '',
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory | 'all'>('all')
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)

  const availableCategories: TokenCategory[] = categories || ['contact', 'campaign', 'email', 'date', 'custom']

  // Filter tokens by category and search
  const filteredTokens = useMemo(() => {
    let result = tokens

    // Filter by category
    if (selectedCategory !== 'all') {
      result = getTokensByCategory(selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      result = searchTokens(searchQuery, result)
    }

    return result
  }, [tokens, selectedCategory, searchQuery])

  const handleTokenSelect = (token: EmailToken) => {
    onTokenSelect(token)
  }

  const handleCopyToken = async (token: EmailToken) => {
    const tokenString = generateTokenString(token)
    try {
      await navigator.clipboard.writeText(tokenString)
      setCopiedTokenId(token.id)
      setTimeout(() => setCopiedTokenId(null), 2000)
    } catch (error) {
      console.error('Failed to copy token:', error)
    }
  }

  const getCategoryIcon = (category: TokenCategory) => {
    switch (category) {
      case 'contact':
        return User
      case 'campaign':
        return Megaphone
      case 'email':
        return Mail
      case 'date':
        return Calendar
      case 'custom':
        return Tag
      default:
        return Tag
    }
  }

  const getCategoryLabel = (category: TokenCategory) => {
    switch (category) {
      case 'contact':
        return 'Contact Fields'
      case 'campaign':
        return 'Campaign Fields'
      case 'email':
        return 'Email Fields'
      case 'date':
        return 'Date & Time'
      case 'custom':
        return 'Custom'
      default:
        return category
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Personalization Tokens</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search tokens"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
          }`}
          aria-label="All categories"
        >
          All
        </button>
        {availableCategories.map((category) => {
          const Icon = getCategoryIcon(category)
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap flex items-center gap-1 transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              aria-label={`Filter by ${getCategoryLabel(category)}`}
            >
              <Icon className="w-3 h-3" />
              {getCategoryLabel(category)}
            </button>
          )
        })}
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tokens found</p>
          </div>
        ) : (
          filteredTokens.map((token) => {
            const tokenString = generateTokenString(token)
            const Icon = getCategoryIcon(token.category)
            const isCopied = copiedTokenId === token.id

            return (
              <div
                key={token.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{token.label}</span>
                    </div>
                    {token.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{token.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-mono flex-1">
                        {tokenString}
                      </code>
                      <button
                        onClick={() => handleCopyToken(token)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        aria-label={`Copy token ${token.label}`}
                        title="Copy token"
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleTokenSelect(token)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                        aria-label={`Insert token ${token.label}`}
                      >
                        Insert
                      </button>
                    </div>
                    {token.exampleValue && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Example: {token.exampleValue}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

