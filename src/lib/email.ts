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

export async function sendEditionReviewEmail(
  to: string,
  editionId: string,
  weekStart: string,
  issueNumber: number
) {
  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/editions/${editionId}`

  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: `Edition #${issueNumber} is ready for review`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">New Edition Ready</h1>
        <p style="color: #44403c; font-size: 16px;">
          Edition #${issueNumber} (week of ${weekStart}) has been generated and is waiting for your review.
        </p>
        <p style="color: #44403c; font-size: 14px;">
          Review the content, edit or regenerate any sections, then approve it. If you don't review it by Saturday morning, it will be auto-approved.
        </p>
        <a href="${reviewUrl}" style="display: inline-block; background: #292524; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin-top: 16px;">
          Review Edition &rarr;
        </a>
      </div>
    `,
  })
}

export async function sendFinalEmail(
  to: string,
  familyName: string,
  pdfBuffer: Buffer,
  weekStart: string,
  riddleAnswer?: string | null
) {
  const riddleHtml = riddleAnswer
    ? `<div style="margin-top: 20px; padding: 12px 16px; background: #f5f5f0; border-radius: 6px;">
        <p style="color: #44403c; font-size: 14px; margin: 0;">
          <strong>This week's riddle answer:</strong> ${riddleAnswer}
        </p>
      </div>`
    : ''

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
        ${riddleHtml}
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
