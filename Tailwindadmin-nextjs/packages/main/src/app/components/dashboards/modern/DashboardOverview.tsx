"use client"
import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

const DashboardOverview = () => {
  const [lastUpdated, setLastUpdated] = useState<string>('')
  
  useEffect(() => {
    // Fetch last updated time from API
    const fetchLastUpdated = async () => {
      try {
        const response = await fetch('/api/dashboard/last-updated')
        if (response.ok) {
          const data = await response.json()
          setLastUpdated(data.lastUpdated || '')
        }
      } catch (error) {
        console.error('Error fetching last updated:', error)
      }
    }
    
    fetchLastUpdated()
  }, [])

  const handleCustomize = () => {
    // Customize button functionality - maintain existing API routes
    // This should trigger the customization modal/dialog
    console.log('Customize clicked')
  }

  return (
    <>
      <Card className='bg-lightprimary dark:bg-lightprimary shadow-none pb-0 w-full'>
        <div className='grid grid-cols-12 gap-6 items-center'>
          <div className='md:col-span-6 col-span-12'>
            <h5 className='text-lg mt-2 font-semibold text-dark dark:text-white'>
              Dashboard Overview
            </h5>
            <p className='text-ld opacity-75 text-sm font-medium py-5 text-dark dark:text-white'>
              Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
            </p>
            {lastUpdated && (
              <p className='text-xs opacity-60 mb-4 text-dark dark:text-white'>
                Last updated: {lastUpdated}
              </p>
            )}
          </div>
          <div className='md:col-span-6 col-span-12 flex items-center justify-end gap-4'>
            <div className='hidden md:block flex-1'>
              <Image
                src='/images/backgrounds/track-bg.png'
                alt='banner'
                width={400}
                height={240}
                className='ms-auto'
              />
            </div>
            <Button 
              variant={'info'}
              onClick={handleCustomize}
              className='shrink-0'
            >
              Customize
            </Button>
          </div>
        </div>
      </Card>
    </>
  )
}

export { DashboardOverview }
