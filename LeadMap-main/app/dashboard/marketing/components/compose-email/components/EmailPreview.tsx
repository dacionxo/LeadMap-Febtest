'use client'

import { useState, useMemo } from 'react'
import { Monitor, Smartphone, Tablet, Mail, X, Maximize2 } from 'lucide-react'
import type { EmailPreviewProps, PreviewDeviceOption, EmailClientOption } from '../types'

/**
 * Email Preview Component
 * Multi-device and email client preview following Mautic patterns
 * Following .cursorrules: TailwindCSS, accessibility, TypeScript interfaces
 */

const DEVICES: PreviewDeviceOption[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: '768px' },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: '375px' },
]

const EMAIL_CLIENTS: EmailClientOption[] = [
  { id: 'gmail', label: 'Gmail', className: 'gmail-preview' },
  { id: 'outlook', label: 'Outlook', className: 'outlook-preview' },
  { id: 'apple', label: 'Apple Mail', className: 'apple-preview' },
  { id: 'default', label: 'Default', className: 'default-preview' },
]

export default function EmailPreview({
  htmlContent,
  subject,
  fromName,
  fromEmail,
  previewText,
  tokenContext,
  onClose,
  onSendTest,
}: EmailPreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<PreviewDeviceOption>(DEVICES[0])
  const [selectedClient, setSelectedClient] = useState<EmailClientOption>(EMAIL_CLIENTS[3]) // Default
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  // Replace tokens in preview content
  const processedContent = useMemo(() => {
    if (!htmlContent) return ''
    
    let content = htmlContent
    
    // Simple token replacement for preview (basic implementation)
    if (tokenContext) {
      Object.entries(tokenContext).forEach(([key, value]) => {
        const tokenPattern = new RegExp(`\\{${key}\\}`, 'g')
        content = content.replace(tokenPattern, String(value || ''))
      })
    }
    
    return content
  }, [htmlContent, tokenContext])

  const handleSendTest = async () => {
    if (!onSendTest) return
    
    setSendingTest(true)
    try {
      await onSendTest()
    } catch (error) {
      console.error('Error sending test email:', error)
    } finally {
      setSendingTest(false)
    }
  }

  const deviceStyle = useMemo(() => {
    return {
      maxWidth: selectedDevice.width,
      margin: '0 auto',
    }
  }, [selectedDevice])

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Preview</h2>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Exit fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen Content */}
          <div className="flex-1 overflow-auto p-4">
            <div style={deviceStyle} className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <div
                className={`${selectedClient.className} bg-white dark:bg-gray-900`}
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Preview Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Fullscreen preview"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Device Selector */}
        <div className="flex items-center gap-2 mb-4">
          {DEVICES.map((device) => {
            const Icon = device.icon
            return (
              <button
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedDevice.id === device.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                aria-label={`Preview on ${device.label}`}
              >
                <Icon className="w-4 h-4" />
                {device.label}
              </button>
            )
          })}
        </div>

        {/* Email Client Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {EMAIL_CLIENTS.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedClient.id === client.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label={`Preview in ${client.label}`}
            >
              {client.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 overflow-auto" style={{ maxHeight: '600px' }}>
        <div style={deviceStyle} className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-lg">
          {/* Email Header Info */}
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-3 h-3" />
              <span className="font-medium">From:</span>
              <span>{fromName || fromEmail || 'Sender'}</span>
              {fromEmail && fromName && (
                <>
                  <span>&lt;{fromEmail}&gt;</span>
                </>
              )}
            </div>
            {subject && (
              <div className="font-medium text-gray-900 dark:text-white mb-1">Subject: {subject}</div>
            )}
            {previewText && (
              <div className="text-gray-500 dark:text-gray-500">{previewText}</div>
            )}
          </div>

          {/* Email Body */}
          <div
            className={`${selectedClient.className} bg-white dark:bg-gray-900 min-h-[400px]`}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </div>

      {/* Preview Footer */}
      {onSendTest && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            aria-label="Send test email"
          >
            {sendingTest ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Test Email
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}


