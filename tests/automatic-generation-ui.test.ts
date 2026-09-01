import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('automatische generatie-interface', () => {
  it('toont geen interne sessie- of beveiligingsmeldingen', () => {
    expect(read('app/wizard/page.tsx')).not.toContain('Je concept wordt veilig geladen')
    expect(read('app/generate-articles/page.tsx')).not.toContain('Deze weergave is beveiligd')
  })

  it('biedt geen handmatige knop voor de eerste artikelgeneratie', () => {
    const editor = read('app/generate-articles/page.tsx')
    expect(editor).not.toContain('Genereer alle 8 artikelen')
    expect(editor).toContain('hasTriggeredAutomaticGeneration')
  })

  it('markeert een mislukte generatie niet als klaar', () => {
    const loading = read('app/loading-screen/page.tsx')
    expect(loading).not.toContain('.finally(() => setKlaar(true))')
    expect(loading).toContain("if (!res.ok || !result?.success || !result.articles)")
    expect(loading).toContain('setKlaar(true)')
  })

  it('houdt de herstellink beschikbaar nadat de generatie klaar is', () => {
    expect(read('app/loading-screen/page.tsx')).toContain('RecoveryEmailForm')
    expect(read('app/generate-articles/page.tsx')).toContain('RecoveryEmailForm')
  })

  it('toont pas succes nadat de mailprovider het bericht accepteert', () => {
    const route = read('app/api/send-email/route.ts')
    expect(route).toContain("if (error || !data?.id)")
    expect(route).toContain("status: 503")
  })
})
