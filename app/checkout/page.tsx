'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Product = 'pdf' | 'print' | 'ingelijst'

const OPTIES: { id: Product; naam: string; prijs: string; bedrag: number; tekst: string; levering: string; vlak: string; lijst?: string }[] = [
  {
    id: 'pdf',
    naam: 'Alleen PDF',
    prijs: '€ 14,95',
    bedrag: 14.95,
    tekst: 'Drukklare PDF in A3-formaat. Direct downloaden, zelf printen of laten drukken.',
    levering: 'Direct beschikbaar na betaling',
    vlak: '#F5F1E9',
  },
  {
    id: 'print',
    naam: 'Print',
    prijs: '€ 29,95',
    bedrag: 29.95,
    tekst: 'Gedrukt op krantenpapier, A3-formaat. Inclusief de PDF.',
    levering: 'Verzending binnen 2 werkdagen',
    vlak: '#F5F1E9',
  },
  {
    id: 'ingelijst',
    naam: 'Ingelijst',
    prijs: '€ 59,95',
    bedrag: 59.95,
    tekst: 'Eiken lijst, 30 × 42 cm, met passe-partout. Ophangklaar geleverd. Inclusief de PDF.',
    levering: 'Verzending binnen 5 werkdagen',
    vlak: '#E6DDCE',
    lijst: '4px solid #3A2E24',
  },
]

const BETAALWIJZEN = ['iDEAL', 'Bancontact', 'Creditcard']

export default function CheckoutPage() {
  const router = useRouter()
  const [gekozen, setGekozen] = useState<Product>('ingelijst')
  const [email, setEmail] = useState('')
  const [betaal, setBetaal] = useState(0)
  const [testData, setTestData] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('babykrant_test_data')
    if (stored) setTestData(JSON.parse(stored))
  }, [])

  const optie = OPTIES.find(o => o.id === gekozen)!
  const bonRegels = [
    { k: optie.naam, v: optie.prijs },
    { k: 'Herschrijvingen (0×)', v: '€ 0,00' },
    { k: 'Verzending', v: gekozen === 'pdf' ? 'Gratis' : '€ 4,95' },
  ]
  const totaal = optie.bedrag + (gekozen === 'pdf' ? 0 : 4.95)

  return (
    <div className="min-h-screen bg-cream text-dark font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/[.92] backdrop-blur-sm border-b border-dark/10">
        <div className="max-w-container mx-auto px-7 py-3.5 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[30px] h-[30px] rounded-full bg-sage flex items-center justify-center text-cream font-extrabold text-[15px]">b</div>
            <div className="font-bold text-[19px] tracking-tight text-dark">babykrantje<span className="text-terracotta">.nl</span></div>
          </Link>
        </div>
      </div>

      <div className="max-w-container mx-auto px-7 py-9">
        <button
          onClick={() => router.push('/generate-articles')}
          className="bg-transparent border-none text-sm text-muted cursor-pointer p-0 mb-[18px] block"
        >
          &larr; Terug naar je krant
        </button>

        <h1 className="text-[44px] leading-none tracking-[-0.03em] font-extrabold mb-2">Hoe wil je hem hebben?</h1>
        <p className="font-serif text-lg text-subtle mb-8">Eenmalige aankoop. De PDF krijg je altijd mee, ook bij een print.</p>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] mb-[34px]">
          {OPTIES.map(o => {
            const on = gekozen === o.id
            return (
              <div
                key={o.id}
                onClick={() => setGekozen(o.id)}
                className="cursor-pointer rounded-[18px] p-[22px] transition-colors"
                style={{
                  border: `2px solid ${on ? '#23231F' : 'rgba(35,35,31,.15)'}`,
                  background: on ? '#FFFDF9' : '#FBF7F1',
                }}
              >
                {/* Mini newspaper preview */}
                <div
                  className="h-[150px] rounded-xl overflow-hidden mb-4 flex items-center justify-center"
                  style={{ background: o.vlak }}
                >
                  <div
                    className="w-[88px] h-[124px] bg-[#FFFDF9] shadow-[0_8px_18px_-8px_rgba(35,35,31,.5)] flex flex-col p-[5px] gap-[3px]"
                    style={{ border: o.lijst || 'none' }}
                  >
                    <div className="h-4 bg-sage" />
                    <div className="h-[34px] bg-[#ECE7DD]" />
                    <div className="h-[3px] bg-[#DAD3C6]" />
                    <div className="h-[3px] bg-[#DAD3C6]" />
                    <div className="h-[3px] bg-[#DAD3C6] w-[70%]" />
                    <div className="h-[3px] bg-[#DAD3C6]" />
                    <div className="h-[3px] bg-[#DAD3C6] w-[60%]" />
                  </div>
                </div>

                <div className="flex justify-between items-baseline mb-1.5">
                  <div className="font-bold text-[19px]">{o.naam}</div>
                  <div className="font-extrabold text-xl">{o.prijs}</div>
                </div>
                <div className="font-serif text-[15px] leading-relaxed text-subtle">{o.tekst}</div>
                <div className="text-[13px] text-muted-light mt-2.5">{o.levering}</div>
              </div>
            )
          })}
        </div>

        {/* Bottom row: framed preview + order form */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-7 items-start">
          {/* Left: framed preview */}
          <div className="bg-[#F1EADF] rounded-[18px] p-[30px]">
            <div className="text-[13px] tracking-[.12em] uppercase text-muted mb-4">Zo hangt hij straks</div>
            <div className="bg-[#E6DDCE] rounded-xl p-[38px] flex justify-center">
              <div className="bg-[#3A2E24] p-3.5 shadow-[0_26px_44px_-22px_rgba(35,35,31,.65)]">
                <div className="bg-cream p-3">
                  <div className="w-[274px] h-[387px] overflow-hidden bg-white flex flex-col p-2 gap-1">
                    <div className="h-5 bg-sage" />
                    <div className="h-10 bg-[#ECE7DD]" />
                    <div className="space-y-1 flex-1">
                      <div className="h-[3px] bg-[#DAD3C6]" />
                      <div className="h-[3px] bg-[#DAD3C6]" />
                      <div className="h-[3px] bg-[#DAD3C6] w-[70%]" />
                      <div className="h-[3px] bg-[#DAD3C6]" />
                      <div className="h-[3px] bg-[#DAD3C6] w-[60%]" />
                      <div className="h-8 bg-[#ECE7DD] mt-2" />
                      <div className="h-[3px] bg-[#DAD3C6]" />
                      <div className="h-[3px] bg-[#DAD3C6]" />
                      <div className="h-[3px] bg-[#DAD3C6] w-[80%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="font-serif text-[15.5px] text-subtle mt-4">
              Eiken lijst, 30 &times; 42 cm, met passe-partout. Ophangklaar geleverd.
            </div>
          </div>

          {/* Right: order summary */}
          <div className="bg-[#FFFDF9] border border-dark/[.12] rounded-[18px] p-[26px]">
            <div className="font-bold text-[19px] mb-4">Je bestelling</div>

            {bonRegels.map((r, i) => (
              <div key={i} className="flex justify-between py-[9px] text-[15px] border-b border-dark/[.08]">
                <span>{r.k}</span>
                <span>{r.v}</span>
              </div>
            ))}

            <div className="flex justify-between py-4 pb-5 font-extrabold text-[22px]">
              <span>Totaal</span>
              <span>&euro; {totaal.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <input
                type="email"
                placeholder="E-mailadres"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-[15px] py-[13px] border border-dark/20 rounded-[10px] text-base bg-white"
              />

              <div className="flex gap-2">
                {BETAALWIJZEN.map((b, i) => (
                  <button
                    key={b}
                    onClick={() => setBetaal(i)}
                    className="flex-1 text-center border rounded-[10px] py-[11px] px-1.5 text-[13.5px] cursor-pointer"
                    style={{
                      borderColor: betaal === i ? '#23231F' : 'rgba(35,35,31,.18)',
                      background: betaal === i ? '#F5F1E9' : '#fff',
                      fontWeight: betaal === i ? 600 : 400,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <button className="border-none bg-terracotta text-cream font-semibold text-[17px] py-4 rounded-pill cursor-pointer mt-1">
                Betalen en downloaden
              </button>
            </div>

            <div className="text-[13px] text-muted-light mt-3.5 leading-relaxed">
              Na betaling verdwijnt het watermerk en staat de drukklare PDF direct klaar.
              Niet blij? Geld terug binnen 14 dagen.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
