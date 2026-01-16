'use client'

import { Icon } from '@iconify/react'
import Link from 'next/link'

interface MessagesProps {
  activeDir?: 'ltr' | 'rtl'
}

const Messages = ({ activeDir = 'ltr' }: MessagesProps) => {
  return (
    <div className="relative group/menu px-4">
      <div className="relative">
        <span className="relative after:absolute after:w-10 after:h-10 after:rounded-full hover:text-primary after:-top-1/2 hover:after:bg-lightprimary text-link dark:text-darklink rounded-full flex justify-center items-center cursor-pointer group-hover/menu:after:bg-lightprimary group-hover/menu:!text-primary">
          <Icon icon="tabler:bell-ringing" height={20} />
        </span>
        <span className="rounded-full absolute -end-[6px] -top-[5px] text-[10px] h-2 w-2 bg-primary flex justify-center items-center"></span>
      </div>

      {/* Dropdown - will be controlled by parent Header */}
      <div className="hidden dropdown-messages">
        {/* Dropdown content will be handled by parent */}
      </div>
    </div>
  )
}

export default Messages
