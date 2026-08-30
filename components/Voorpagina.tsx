interface WeerUur {
  deel: string
  temp: string
  kleur: string
}

interface Feit {
  k: string
  v: string
}

export interface VoorpaginaProps {
  band?: string
  tint?: string
  editie?: string
  mastheadA?: string
  mastheadB?: string
  volledigeNaam?: string
  datumLang?: string
  plaats?: string
  kop?: string
  hoofdfotoBijschrift?: string
  stripBijschrift?: string
  lead?: string
  feiten?: Feit[]
  horoscoopKop?: string
  horoscoop?: string[]
  hoofdartikel?: string[]
  naamKop?: string
  naamBetekenis?: string[]
  naamgenootBijschrift?: string
  naamgenoten?: string[]
  geborenKop?: string
  geborenOp?: string[]
  nieuwsKop?: string
  nieuwsBijschrift?: string
  nieuws?: string[]
  weerKop?: string
  weerMax?: string
  weerPlaats?: string
  weerUren?: WeerUur[]
  weer?: string[]
  cultuurBijschrift?: string
  cultuur?: string[]
  watermerk?: boolean
  foto1Url?: string
  foto2Url?: string
  foto3Url?: string
  foto4Url?: string
}

const PLACEHOLDER_BG = 'repeating-linear-gradient(135deg,#ece7dd 0 8px,#f5f1e9 8px 16px)'
const PLACEHOLDER_BG_TINT = 'repeating-linear-gradient(135deg,rgba(35,35,31,.07) 0 8px,rgba(35,35,31,.02) 8px 16px)'

function PhotoSlot({ url, label, height, tinted }: { url?: string; label: string; height: string; tinted?: boolean }) {
  if (url) {
    return (
      <div style={{ height, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{
      height,
      background: tinted ? PLACEHOLDER_BG_TINT : PLACEHOLDER_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#8d877c' }}>{label}</span>
    </div>
  )
}

export default function Voorpagina(props: VoorpaginaProps) {
  const {
    band = '#8FA88A', tint = '#F6DFD1', editie = 'Editie 1, jaargang 1',
    mastheadA = 'De Baby', mastheadB = 'krant', volledigeNaam = 'Je baby',
    datumLang = 'De geboortedag', plaats = '',
    kop = 'Baby is geboren!',
    hoofdfotoBijschrift = '', stripBijschrift = '',
    lead = '',
    feiten = [],
    horoscoopKop = 'Sterrenbeeld',
    horoscoop = [],
    hoofdartikel = [],
    naamKop = 'De naam',
    naamBetekenis = [],
    naamgenootBijschrift = '',
    naamgenoten = [],
    geborenKop = 'Ook geboren op deze dag',
    geborenOp = [],
    nieuwsKop = 'Het nieuws',
    nieuwsBijschrift = '',
    nieuws = [],
    weerKop = 'Het weer',
    weerMax = '',
    weerPlaats = '',
    weerUren = [],
    weer = [],
    cultuurBijschrift = '',
    cultuur = [],
    watermerk = false,
    foto1Url, foto2Url, foto3Url, foto4Url,
  } = props

  return (
    <div style={{
      width: 760, height: 1075, background: '#fffdf9', color: '#23231f',
      fontFamily: "'Source Serif 4',Georgia,serif",
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {/* Top band */}
      <div style={{ padding: '22px 26px 16px', color: '#fffdf9', position: 'relative', background: band }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 11,
          letterSpacing: '.14em', textTransform: 'uppercase', opacity: .85,
        }}>
          <span>Speciale editie</span>
          <span>{editie}</span>
        </div>
        <div style={{
          fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700,
          fontSize: 70, lineHeight: .94, letterSpacing: '-.03em', marginTop: 8,
        }}>{mastheadA}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 300,
            fontSize: 32, lineHeight: 1, letterSpacing: '-.01em', opacity: .95,
          }}>{mastheadB}</div>
          <div style={{
            fontFamily: "'Source Serif 4',serif", fontStyle: 'italic', fontSize: 14,
            opacity: .9, textAlign: 'right', paddingBottom: 4,
          }}>
            ter gelegenheid van de geboorte van<br />
            <strong style={{ fontStyle: 'normal', fontWeight: 600 }}>{volledigeNaam}</strong>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '7px 26px',
        fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 11,
        letterSpacing: '.08em', textTransform: 'uppercase',
        borderBottom: '2px solid #23231f', color: '#23231f',
      }}>
        <span>{datumLang}</span>
        <span>{plaats}</span>
        <span>Oplage: 1</span>
      </div>

      {/* Main 3-column grid */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '150px 380px 180px',
        gap: 12, padding: '14px 26px 0', minHeight: 0,
      }}>
        {/* Left column: feiten + horoscoop */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 12px 14px', background: tint }}>
            <div style={{
              fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 15,
              letterSpacing: '-.01em', textAlign: 'center', paddingBottom: 8, marginBottom: 8,
              borderBottom: '1px solid rgba(35,35,31,.25)',
            }}>Feiten &amp; cijfers</div>
            {feiten.map((f, i) => (
              <div key={i} style={{ textAlign: 'center', marginBottom: 7 }}>
                <div style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 9,
                  letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6,
                }}>{f.k}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{
              fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 15,
              borderBottom: '1px solid #23231f', paddingBottom: 3, marginBottom: 6,
            }}>{horoscoopKop}</div>
            {horoscoop.map((par, i) => (
              <p key={i} style={{
                fontSize: 11, lineHeight: 1.42, marginBottom: 7,
                textAlign: 'justify', hyphens: 'auto',
                display: '-webkit-box', WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 7, overflow: 'hidden',
              }}>{par}</p>
            ))}
          </div>
        </div>

        {/* Center column: main story */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <PhotoSlot url={foto1Url} label="hoofdfoto" height="184px" />
          {hoofdfotoBijschrift && (
            <div style={{
              fontFamily: "'Source Serif 4',serif", fontStyle: 'italic', fontSize: 10,
              color: '#6f6a61', textAlign: 'right', marginTop: -5,
            }}>{hoofdfotoBijschrift}</div>
          )}
          <h1 style={{
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800,
            fontSize: 44, lineHeight: .95, letterSpacing: '-.035em', margin: 0,
          }}>{kop}</h1>
          {lead && (
            <div style={{
              fontSize: 13, lineHeight: 1.4, fontWeight: 600,
              borderBottom: '1px solid rgba(35,35,31,.25)', paddingBottom: 8,
            }}>{lead}</div>
          )}
          <div style={{
            columns: 2, columnGap: 16,
            columnRule: '1px solid rgba(35,35,31,.15)',
            maxHeight: 206, overflow: 'hidden',
          }}>
            {hoofdartikel.map((par, i) => (
              <p key={i} style={{
                fontSize: 11.5, lineHeight: 1.46, marginBottom: 8,
                textAlign: 'justify', hyphens: 'auto',
                display: '-webkit-box', WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 7, overflow: 'hidden',
              }}>{par}</p>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 2 }}>
            <PhotoSlot url={foto2Url} label="foto 2" height="60px" />
            <PhotoSlot url={foto3Url} label="foto 3" height="60px" />
            <PhotoSlot url={foto4Url} label="foto 4" height="60px" />
          </div>
          {stripBijschrift && (
            <div style={{
              fontFamily: "'Source Serif 4',serif", fontStyle: 'italic', fontSize: 10, color: '#6f6a61',
            }}>{stripBijschrift}</div>
          )}
        </div>

        {/* Right column: naam, naamgenoten, geboren op */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 11,
          borderLeft: '1px solid rgba(35,35,31,.2)', paddingLeft: 12,
          minHeight: 0, overflow: 'hidden',
        }}>
          <div>
            <div style={{
              fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14,
              lineHeight: 1.1, borderBottom: '1px solid #23231f', paddingBottom: 3, marginBottom: 6,
            }}>{naamKop}</div>
            {naamBetekenis.map((par, i) => (
              <p key={i} style={{
                fontSize: 11, lineHeight: 1.42, marginBottom: 7,
                textAlign: 'justify', hyphens: 'auto',
                display: '-webkit-box', WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 6, overflow: 'hidden',
              }}>{par}</p>
            ))}
          </div>
          <div style={{ padding: '9px 10px', background: tint }}>
            <div style={{
              fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 6,
            }}>Naamgenoten</div>
            <PhotoSlot label="foto naamgenoot" height="60px" tinted />
            {naamgenootBijschrift && (
              <div style={{
                fontFamily: "'Source Serif 4',serif", fontStyle: 'italic',
                fontSize: 9.5, color: '#6f6a61', textAlign: 'right', marginBottom: 5, marginTop: 5,
              }}>{naamgenootBijschrift}</div>
            )}
            {naamgenoten.map((par, i) => (
              <p key={i} style={{
                fontSize: 11, lineHeight: 1.42, marginBottom: 5,
                display: '-webkit-box', WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 5, overflow: 'hidden',
              }}>{par}</p>
            ))}
          </div>
          <div>
            <div style={{
              fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14,
              borderBottom: '1px solid #23231f', paddingBottom: 3, marginBottom: 6,
            }}>{geborenKop}</div>
            <PhotoSlot label="portretten" height="46px" />
            {geborenOp.map((par, i) => (
              <p key={i} style={{
                fontSize: 11, lineHeight: 1.42, marginBottom: 6, marginTop: 6,
                textAlign: 'justify', hyphens: 'auto',
                display: '-webkit-box', WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 6, overflow: 'hidden',
              }}>{par}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom 3-column: nieuws, weer, cultuur */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12, padding: '12px 26px 20px', marginTop: 8,
        borderTop: '2px solid #23231f',
      }}>
        {/* Nieuws */}
        <div>
          <div style={{
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 6,
          }}>{nieuwsKop}</div>
          <PhotoSlot label="foto bij het nieuws" height="74px" />
          {nieuwsBijschrift && (
            <div style={{
              fontFamily: "'Source Serif 4',serif", fontStyle: 'italic',
              fontSize: 9.5, color: '#6f6a61', marginBottom: 5, marginTop: 4,
            }}>{nieuwsBijschrift}</div>
          )}
          {nieuws.map((par, i) => (
            <p key={i} style={{
              fontSize: 11, lineHeight: 1.42, marginBottom: 6,
              textAlign: 'justify', hyphens: 'auto',
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5, overflow: 'hidden',
            }}>{par}</p>
          ))}
        </div>

        {/* Weer */}
        <div>
          <div style={{
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 6,
          }}>{weerKop}</div>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'stretch',
            background: tint, padding: '9px 11px', marginBottom: 6,
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              minWidth: 70, borderRight: '1px solid rgba(35,35,31,.2)', paddingRight: 10,
            }}>
              <div style={{
                fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800,
                fontSize: 30, lineHeight: 1, letterSpacing: '-.03em',
              }}>{weerMax}</div>
              <div style={{
                fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 9,
                letterSpacing: '.08em', textTransform: 'uppercase', opacity: .65, marginTop: 3,
              }}>{weerPlaats}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
              {weerUren.map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5 }}>
                  <div style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: u.kleur }} />
                  <span style={{ flex: 1, opacity: .75 }}>{u.deel}</span>
                  <strong style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 11 }}>{u.temp}</strong>
                </div>
              ))}
            </div>
          </div>
          {weer.map((par, i) => (
            <p key={i} style={{
              fontSize: 11, lineHeight: 1.42, marginBottom: 6,
              textAlign: 'justify', hyphens: 'auto',
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5, overflow: 'hidden',
            }}>{par}</p>
          ))}
        </div>

        {/* Cultuur */}
        <div style={{ padding: '9px 10px', background: tint }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 6,
          }}>Muziek, films &amp; series</div>
          <PhotoSlot label="foto artiest of film" height="74px" tinted />
          {cultuurBijschrift && (
            <div style={{
              fontFamily: "'Source Serif 4',serif", fontStyle: 'italic',
              fontSize: 9.5, color: '#6f6a61', marginBottom: 5, marginTop: 4,
            }}>{cultuurBijschrift}</div>
          )}
          {cultuur.map((par, i) => (
            <p key={i} style={{
              fontSize: 11, lineHeight: 1.42, marginBottom: 6,
              textAlign: 'justify', hyphens: 'auto',
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5, overflow: 'hidden',
            }}>{par}</p>
          ))}
        </div>
      </div>

      {/* Watermark overlay */}
      {watermerk && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: '-30%',
            background: 'repeating-linear-gradient(-32deg,rgba(35,35,31,.055) 0 2px,transparent 2px 96px)',
          }} />
          <div style={{
            transform: 'rotate(-32deg)',
            fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800,
            fontSize: 62, letterSpacing: '.06em', color: 'rgba(35,35,31,.13)',
            textAlign: 'center', lineHeight: 1.5, whiteSpace: 'nowrap',
          }}>
            VOORBEELD<br />BABYKRANTJE.NL<br />VOORBEELD
          </div>
        </div>
      )}
    </div>
  )
}
