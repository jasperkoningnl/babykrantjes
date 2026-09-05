import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, getAdminIdentity } from '@/lib/adminAuth'
import NewsEditor from '@/components/NewsEditor'
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminPage() {
  const actor = await getAdminIdentity((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!actor) redirect('/admin/login')
  return <NewsEditor />
}
