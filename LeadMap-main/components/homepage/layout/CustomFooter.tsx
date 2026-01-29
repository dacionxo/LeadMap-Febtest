import Link from 'next/link'
import Image from 'next/image'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'

export const CustomFooter = () => {
  const navLinks1 = [
    { key: 'link1', title: 'Pricing', link: '/pricing' },
    { key: 'link2', title: 'Dashboard', link: '/dashboard' },
    { key: 'link3', title: 'FAQ', link: '/contact' },
    { key: 'link4', title: 'Privacy', link: '/privacy' },
  ]
  const navLinks2 = [
    { key: 'link1', title: 'Terms of Service', link: '/terms' },
    { key: 'link2', title: 'Refund Policy', link: '/refund-policy' },
    { key: 'link3', title: 'Contact', link: '/contact' },
  ]

  return (
    <>
      <div className="container-md px-4 lg:py-24 py-20">
        <div className="grid grid-cols-12 gap-6">
          <div className="lg:col-span-4 sm:col-span-6 col-span-12">
            <h4 className="text-lg text-link dark:text-white font-semibold mb-8">
              Company
            </h4>
            <div className="flex flex-col gap-4">
              {navLinks1.map((item) => (
                <Link
                  key={item.key}
                  href={item.link}
                  className="text-sm font-medium text-lightmuted hover:text-primary dark:text-darklink dark:hover:text-primary w-fit"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 sm:col-span-6 col-span-12">
            <h4 className="text-lg text-link dark:text-white font-semibold mb-8">
              Legal
            </h4>
            <div className="flex flex-col gap-4">
              {navLinks2.map((item) => (
                <Link
                  key={item.key}
                  href={item.link}
                  className="text-sm font-medium text-lightmuted hover:text-primary dark:text-darklink dark:hover:text-primary w-fit"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 sm:col-span-6 col-span-12">
            <h4 className="text-lg text-link dark:text-white font-semibold mb-8">
              Follow us
            </h4>
            <div className="flex items-center gap-5">
              <TooltipProvider>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="text-lightmuted hover:text-primary"
                >
                  <span className="sr-only">Facebook</span>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="Twitter"
                  className="text-lightmuted hover:text-primary"
                >
                  <span className="sr-only">Twitter</span>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="text-lightmuted hover:text-primary"
                >
                  <span className="sr-only">LinkedIn</span>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      <div className="container-md px-4 py-10 border-t border-border dark:border-darkborder">
        <div className="flex justify-between items-center flex-wrap">
          <div className="flex items-center gap-4">
            <Image src="/favicon.svg" alt="logo" width={24} height={24} />
            <p className="text-base text-lightmuted dark:text-darklink">
              All rights reserved by NextDeal.
            </p>
          </div>
          <p className="text-base text-lightmuted dark:text-darklink flex items-center gap-1">
            <Link href="/dashboard" className="text-primary hover:underline">
              Dashboard
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
