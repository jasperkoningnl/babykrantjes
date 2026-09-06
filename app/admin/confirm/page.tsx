export const dynamic = 'force-dynamic'
// Hide the token-bearing path/query without making native form POST Origin null.
// The session endpoint must still enforce its same-origin check.
export const metadata = { robots: { index: false, follow: false }, referrer: 'strict-origin' as const }

export default async function Confirm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const token = typeof params.token_hash === 'string' ? params.token_hash : ''
  const state = typeof params.state === 'string' ? params.state : ''
  // GET never consumes the link: mail scanners must not sign in on the editor's behalf.
  return <main className="max-w-lg mx-auto p-8"><h1 className="bk-heading">Open de redactie</h1>
    <p className="bk-subtext">Bevestig dat je wilt inloggen. Werkt de link niet meer? Vraag dan een nieuwe aan.</p>
    <form action="/api/admin/session" method="post">
      <input type="hidden" name="token_hash" value={token} /><input type="hidden" name="state" value={state} />
      <button className="bk-btn-primary">Inloggen</button>
    </form>
    <a href="/admin/login" className="block mt-4 underline">Nieuwe link aanvragen</a>
  </main>
}
