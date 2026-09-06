import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, ADMIN_REFRESH_COOKIE, getAdminIdentity } from '@/lib/adminAuth'
import NewsEditor from '@/components/NewsEditor'
import AdminSessionResume from '@/components/AdminSessionResume'
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminPage() {
  const jar = await cookies()
  const actor = await getAdminIdentity(jar.get(ADMIN_COOKIE)?.value)
  if (!actor && jar.get(ADMIN_REFRESH_COOKIE)?.value) return <AdminSessionResume />
  if (!actor) redirect('/admin/login')
  return <NewsEditor />
}
