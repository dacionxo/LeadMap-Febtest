import type { Metadata } from 'next'
import { Inter, Montserrat, Lato, DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import AdvancedChatButton from '@/components/AdvancedChatButton'
import { ThemeProvider } from '@/components/ThemeProvider'
import GlobalListSelector from './components/GlobalListSelector'
import GoogleMapsScript from '@/components/GoogleMapsScript'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const montserrat = Montserrat({ 
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const lato = Lato({ 
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
  weight: ['400', '700'], // Note: Lato doesn't have weight 500, using 400 with font-weight: 500 will use browser fallback
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'NextDeal - Real Estate Lead Generation',
  description: 'Find undervalued property leads with our subscription-based platform for real estate agents and brokers.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} ${lato.variable} ${dmSans.variable} ${plusJakarta.variable} ${dmSans.className}`}>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <GoogleMapsScript />
        <ThemeProvider>
          <Providers>
            {children}
            <AdvancedChatButton />
            <GlobalListSelector />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
