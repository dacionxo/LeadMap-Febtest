'use client'

import { useState, useEffect } from 'react'
import { X, Filter, Upload } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CreateListModalProps {
  type?: 'people' | 'properties'
  onClose: () => void
  onCreated: () => void
  supabase: SupabaseClient
}

export default function CreateListModal({ type = 'properties', onClose, onCreated, supabase }: CreateListModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Trigger slide-in animation
    setTimeout(() => setIsOpen(true), 10)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('List name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error: insertError } = await supabase
        .from('lists')
        .insert([
          {
            name: name.trim(),
            type: type,
            user_id: user?.id
          }
        ])
        .select()
        .single()

      if (insertError) {
        console.error('Error creating list:', insertError)
        setError(insertError.message || 'Failed to create list')
        return
      }

      onCreated()
    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(onClose, 300) // Wait for animation to complete
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease',
          backdropFilter: 'blur(4px)'
        }}
        onClick={handleClose}
      />
      
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
          maxWidth: '90vw',
          background: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0
          }}>
            New List
          </h2>
          <button
            onClick={handleClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9'
              e.currentTarget.style.color = '#1e293b'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#64748b'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          <form onSubmit={handleSubmit}>
            {/* Name Input */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                marginBottom: '8px'
              }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  placeholder="Enter list name"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#1e293b',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = error ? '#ef4444' : '#d1d5db'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
              {error && (
                <div style={{
                  marginTop: '8px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '12px',
                  color: '#ef4444'
                }}>
                  {error}
                </div>
              )}
            </div>


            {/* Separator */}
            <hr style={{
              border: 'none',
              borderTop: '1px solid #e2e8f0',
              margin: '24px 0'
            }} />

            {/* Add record from section */}
            <div>
              <p style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1e293b',
                margin: '0 0 16px 0'
              }}>
                Add record from
              </p>

              {/* Filter Option */}
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#ffffff'
              }}>
                <p style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1e293b',
                  margin: '0 0 8px 0'
                }}>
                  Filter
                </p>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#cbd5e1'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                >
                  <Filter size={16} />
                  Select filter
                </button>
              </div>

              {/* CSV Option */}
              <div style={{
                padding: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#ffffff'
              }}>
                <p style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1e293b',
                  margin: '0 0 8px 0'
                }}>
                  CSV
                </p>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#cbd5e1'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                >
                  <Upload size={16} />
                  Upload CSV
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              }
            }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </>
  )
}

