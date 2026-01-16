'use client'

import { Icon } from '@iconify/react'
import { useTheme } from '@/components/ThemeProvider'

const MobileHeaderItems = () => {
  const { theme, setTheme } = useTheme()

  return (
    <nav className="rounded-none bg-white dark:bg-dark flex-1 px-9">
      <div className="xl:hidden block w-full">
        <div className="flex justify-center items-center">
          {/* Theme Toggle */}
          {theme === "light" ? (
            <div
              className="hover:text-primary px-4 group dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-link dark:text-darklink relative"
              onClick={() => setTheme('dark')}
            >
              <span className="flex items-center justify-center relative after:absolute after:w-10 after:h-10 after:rounded-full after:-top-1/2 group-hover:after:bg-lightprimary">
                <Icon icon="tabler:moon" width="20" />
              </span>
            </div>
          ) : (
            <div
              className="hover:text-primary px-4 dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-link dark:text-darklink group relative"
              onClick={() => setTheme('light')}
            >
              <span className="flex items-center justify-center relative after:absolute after:w-10 after:h-10 after:rounded-full after:-top-1/2 group-hover:after:bg-lightprimary">
                <Icon icon="solar:sun-bold-duotone" width="20" />
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default MobileHeaderItems
