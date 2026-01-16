'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import Image from 'next/image'

const Languages = [
  {
    flagname: 'English (UK)',
    icon: '/images/flag/icon-flag-en.svg',
    value: 'en',
  },
]

const Language = () => {
  const [showDropdown, setShowDropdown] = useState(false)
  const currentLang = Languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer"
      >
        <Image
          src={currentLang.icon}
          alt="language"
          width={40}
          height={40}
          className="rounded-full h-5 w-5 shrink-0 object-cover cursor-pointer"
          onError={(e) => {
            // Fallback if flag image doesn't exist
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark shadow-md dark:shadow-dark-md rounded-sm py-1 z-50">
          {Languages.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                setShowDropdown(false)
              }}
              className="w-full flex gap-3 items-center py-2 px-4 cursor-pointer hover:bg-muted text-left"
            >
              <Image
                src={item.icon}
                alt={item.flagname}
                width={40}
                height={40}
                className="rounded-full object-cover h-5 w-5"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              <span className="text-sm text-muted-foreground hover:text-primary font-medium leading-[25px]">
                {item.flagname}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { Language }
export default Language
