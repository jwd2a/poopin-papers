import { Resend } from 'resend'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  return new Resend(apiKey)
}

export async function sendPreviewEmail(
  to: string,
  familyName: string,
  previewUrl: string
) {
  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: "Your Poopin' Papers are ready for review!",
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">The ${familyName} Edition</h1>
        <p style="color: #44403c; font-size: 16px;">
          This week's Poopin' Papers are ready for your review. Take a look, make any tweaks, and we'll deliver the final version tomorrow morning.
        </p>
        <a href="${previewUrl}" style="display: inline-block; background: #292524; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin-top: 16px;">
          Preview &amp; Edit &rarr;
        </a>
        <p style="color: #78716c; font-size: 12px; margin-top: 24px; font-style: italic;">
          The Only Newspaper Worth Sitting Down For
        </p>
      </div>
    `,
  })
}

export async function sendFinalEmail(
  to: string,
  familyName: string,
  pdfBuffer: Buffer,
  weekStart: string
) {
  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: "This week's Poopin' Papers are here!",
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">The ${familyName} Edition</h1>
        <p style="color: #44403c; font-size: 16px;">
          This week's paper is attached and ready to print. Hang it up and enjoy!
        </p>
        <p style="color: #78716c; font-size: 12px; margin-top: 24px; font-style: italic;">
          The Only Newspaper Worth Sitting Down For
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `poopin-papers-${weekStart}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
