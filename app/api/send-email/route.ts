import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { email, babyNaam } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mailadres is verplicht' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://babykrantje.nl')

    const naam = babyNaam || 'je kleintje'

    const { error } = await resend.emails.send({
      from: 'Babykrantje <noreply@babykrantje.nl>',
      to: email,
      subject: `Het babykrantje van ${naam} is bijna klaar!`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #23231F;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; border-radius: 50%; background: #8FA88A; color: #FDF8F0; font-weight: 800; font-size: 20px; line-height: 40px; text-align: center; font-family: system-ui, sans-serif;">b</div>
          </div>
          <h1 style="font-size: 26px; font-weight: 800; text-align: center; margin: 0 0 8px; font-family: system-ui, sans-serif; letter-spacing: -0.02em;">
            Het babykrantje van ${naam}
          </h1>
          <p style="text-align: center; color: #7A756C; font-style: italic; margin: 0 0 28px;">
            De redactie is klaar met schrijven
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Goed nieuws! Het babykrantje van <strong>${naam}</strong> wordt op dit moment gemaakt.
            Ga terug naar het tabblad in je browser om de krant te bekijken en eventueel aan te passen.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${siteUrl}" style="display: inline-block; background: #8FA88A; color: #FDF8F0; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; font-family: system-ui, sans-serif;">
              Bekijk babykrantje.nl &rarr;
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #EAE2D5; margin: 32px 0;" />
          <p style="font-size: 13px; color: #A9A398; text-align: center; margin: 0;">
            Je ontvangt deze mail omdat je een babykrantje hebt aangemaakt op babykrantje.nl.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'E-mail kon niet worden verstuurd' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
