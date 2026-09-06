export interface NewsStyleExample { id: string; title: string; news_date: string; body: string; style_note: string }

export function buildNewsStyleExamples(examples: NewsStyleExample[] = []): string {
  if (!examples.length) return ''
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `STIJLVOORBEELDEN VAN DE REDACTEUR:
Onderstaande historische teksten demonstreren toon, onderwerpkeuze, korte context en afwisseling. Het zijn GEEN feitenbronnen voor de gevraagde geboortedag en ze zijn niet opnieuw op juistheid gecontroleerd. Neem geen namen, gebeurtenissen, aantallen of beweringen over uit deze voorbeelden.
De actuele schrijfregels hierboven gaan voor afwijkingen in oudere voorbeelden: behoud de voorgeschreven openingszin, open toegankelijk en niet met oorlog, rampen of overlijden, vermijd specifieke dodentallen en zoek een lichter slot. Kopieer ook geen historische spelfouten. Een klein dagfeit mag aanleiding geven tot grotere context; niet elk onderwerp heeft een hele alinea nodig.
<style_examples>
${examples.slice(0, 5).map(e => `<example>\n<date>${escape(e.news_date)}</date>\n<editorial_note>${escape(e.style_note)}</editorial_note>\n<text>${escape(e.body)}</text>\n</example>`).join('\n')}
</style_examples>`
}
