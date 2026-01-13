'use client'

import { useEffect, useRef, useState } from 'react'
import { Code, Layout, FileText, Loader2 } from 'lucide-react'
import type { EmailEditorProps } from '../types'

// Import GrapesJS CSS (required for proper styling)
import 'grapesjs/dist/css/grapes.min.css'

/**
 * Email Builder Component with GrapesJS Integration
 * Visual drag-and-drop email builder following Mautic patterns
 * Following .cursorrules: TailwindCSS, accessibility, TypeScript interfaces
 */

// Dynamic imports for GrapesJS (code splitting for performance)
let grapesjsModule: any = null
let grapesjsPresetNewsletterModule: any = null

const loadGrapesJS = async () => {
  if (!grapesjsModule) {
    grapesjsModule = await import('grapesjs')
  }
  if (!grapesjsPresetNewsletterModule) {
    grapesjsPresetNewsletterModule = await import('grapesjs-preset-newsletter')
  }
  return {
    grapesjs: grapesjsModule.default || grapesjsModule,
    grapesjsPresetNewsletter: grapesjsPresetNewsletterModule.default || grapesjsPresetNewsletterModule,
  }
}

export default function EmailBuilder({
  content,
  mode,
  onChange,
  onModeChange,
}: EmailEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'builder' | 'html' | 'mjml'>(mode === 'builder' ? 'builder' : 'html')

  useEffect(() => {
    if (!editorRef.current) return

    let mounted = true

    const initEditor = async () => {
      try {
        setLoading(true)
        setError(null)

        const { grapesjs: gjs, grapesjsPresetNewsletter: gjsPresetNewsletter } = await loadGrapesJS()

        if (!mounted) return

        // Initialize GrapesJS editor with newsletter preset (Mautic pattern)
        const editor = gjs.init({
          container: editorRef.current,
          height: '600px',
          fromElement: false,
          storageManager: false, // We'll handle storage manually
          plugins: [gjsPresetNewsletter],
          pluginsOpts: {
            [gjsPresetNewsletter]: {
              modalTitleImport: 'Import template',
              modalTitleExport: 'Export template',
              modalLabelImport: '',
              modalLabelExport: '',
              modalBtnImport: 'Import',
              modalBtnExport: 'Export',
              importViewerOptions: {},
              textCleanCanvas: 'Are you sure you want to clear the canvas?',
              textGeneral: 'General',
              textLayout: 'Layout',
              textComponents: 'Components',
              textStyle: 'Style',
              textTypography: 'Typography',
            },
          },
          blockManager: {
            appendTo: '.blocks-container',
          },
          styleManager: {
            appendTo: '.styles-container',
            sectors: [
              {
                name: 'Dimension',
                open: false,
                buildProps: ['width', 'min-height', 'padding'],
                properties: [
                  {
                    type: 'integer',
                    name: 'The width',
                    property: 'width',
                    units: ['px', '%'],
                    defaults: 'auto',
                    min: 0,
                  },
                ],
              },
              {
                name: 'Extra',
                open: false,
                buildProps: ['background-color', 'box-shadow', 'custom-prop'],
                properties: [
                  {
                    id: 'custom-prop',
                    name: 'Custom Label',
                    property: 'font-size',
                    type: 'select',
                    defaults: '32px',
                    options: [
                      { value: '12px', name: 'Tiny' },
                      { value: '18px', name: 'Medium' },
                      { value: '32px', name: 'Big' },
                    ],
                  },
                ],
              },
            ],
          },
          traitManager: {
            appendTo: '.traits-container',
          },
          layerManager: {
            appendTo: '.layers-container',
          },
          canvas: {
            styles: [
              'https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700',
              'https://fonts.googleapis.com/css?family=Montserrat:100,300,400,500,700',
            ],
          },
        })

        if (!mounted) {
          editor.destroy()
          return
        }

        editorInstanceRef.current = editor

        // Load initial content
        if (content) {
          editor.setComponents(content)
        }

        // Listen for changes
        editor.on('update', () => {
          if (onChange) {
            const html = editor.getHtml()
            onChange(html)
          }
        })

        // Handle mode changes
        const handleModeChange = (newMode: 'builder' | 'html' | 'mjml') => {
          if (newMode === 'html') {
            const html = editor.getHtml()
            setCurrentMode('html')
            if (onModeChange) {
              onModeChange('html')
            }
          } else if (newMode === 'mjml') {
            // MJML mode - would need grapesjs-mjml plugin
            setCurrentMode('mjml')
            if (onModeChange) {
              onModeChange('mjml')
            }
          } else {
            setCurrentMode('builder')
            if (onModeChange) {
              onModeChange('builder')
            }
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error initializing GrapesJS editor:', err)
        setError(err instanceof Error ? err.message : 'Failed to load email builder')
        setLoading(false)
      }
    }

    initEditor()

    return () => {
      mounted = false
      if (editorInstanceRef.current) {
        try {
          editorInstanceRef.current.destroy()
        } catch (e) {
          console.error('Error destroying editor:', e)
        }
        editorInstanceRef.current = null
      }
    }
  }, []) // Only run on mount

  // Update content when prop changes externally (only if not currently editing)
  useEffect(() => {
    if (editorInstanceRef.current && content && mode === 'builder') {
      try {
        const currentHtml = editorInstanceRef.current.getHtml()
        // Only update if content actually changed (avoid infinite loops)
        if (currentHtml.trim() !== content.trim()) {
          editorInstanceRef.current.setComponents(content)
        }
      } catch (err) {
        console.error('Error updating editor content:', err)
      }
    }
  }, [content, mode])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '600px' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading email builder...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <FileText className="w-5 h-5" />
          <div>
            <p className="font-semibold">Error loading email builder</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{error}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Falling back to HTML editor. Please refresh the page to try again.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Visual Builder
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setCurrentMode('builder')
                if (onModeChange) onModeChange('builder')
              }}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                currentMode === 'builder'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Visual builder mode"
            >
              <Layout className="w-3 h-3 inline mr-1" />
              Builder
            </button>
            <button
              onClick={() => {
                setCurrentMode('html')
                if (onModeChange) onModeChange('html')
              }}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                currentMode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="HTML code mode"
            >
              <Code className="w-3 h-3 inline mr-1" />
              HTML
            </button>
            <button
              disabled
              className="px-2 py-1 text-xs text-gray-400 dark:text-gray-600 cursor-not-allowed"
              title="MJML mode (coming soon)"
              aria-label="MJML mode (coming soon)"
            >
              <FileText className="w-3 h-3 inline mr-1" />
              MJML
            </button>
          </div>
        </div>
      </div>

      {/* GrapesJS Editor Container */}
      <div className="flex-1 relative gjs-editor-wrapper" style={{ minHeight: '600px' }}>
        <div
          ref={editorRef}
          className="gjs-editor"
          aria-label="Email visual builder"
        />
        {/* Sidebar containers (GrapesJS will append to these via appendTo config) */}
        <div className="blocks-container" style={{ display: 'none' }} aria-hidden="true" />
        <div className="styles-container" style={{ display: 'none' }} aria-hidden="true" />
        <div className="traits-container" style={{ display: 'none' }} aria-hidden="true" />
        <div className="layers-container" style={{ display: 'none' }} aria-hidden="true" />
      </div>
    </div>
  )
}

