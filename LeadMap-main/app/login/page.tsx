import LoginPage from '@/components/LoginPage'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function Login() {
  return <LoginPage />
}
