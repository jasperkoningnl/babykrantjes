/** A resolved fetch may still be an HTTP error; only acknowledge confirmed saves. */
export async function savePaperEdits(manualEdits: Record<string, string>): Promise<void> {
  const response = await fetch('/api/papers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualEdits }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('Kon wijzigingen niet bewaren')
  const result = await response.json()
  if (result?.ok !== true) throw new Error('Opslag niet bevestigd')
}
