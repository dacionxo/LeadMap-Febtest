/**
 * Postiz Settings Page
 * 
 * Configuration and settings for Postiz integration.
 * This will integrate Postiz's native settings components
 */

'use client'

import DashboardLayout from '../../components/DashboardLayout'
import { PostizProvider } from '../providers/PostizProvider'
import { PostizWrapper } from '../components/PostizWrapper'
import PostizSettings from '../components/PostizSettings'

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <PostizSettings />
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}
