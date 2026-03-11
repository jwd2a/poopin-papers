import { Resend } from 'resend'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  return new Resend(apiKey)
}

// ── Shared email layout ──────────────────────────────────────────────

function emailLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poopin' Papers</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f3ee; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f3ee;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width: 540px; width: 100%;">

          <!-- Masthead -->
          <tr>
            <td align="center" style="padding: 0 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <span style="font-size: 32px; line-height: 1;">&#x1F9FB;</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 3px solid #292524;"></td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #78716c;">Est. 2026 &bull; Weekly Family Edition</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #d6d3d1;"></td>
                </tr>
                <tr>
                  <td align="center" style="padding: 14px 0 6px;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: bold; color: #1c1917; letter-spacing: -0.5px;">Poopin' Papers</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #d6d3d1;"></td>
                </tr>
                <tr>
                  <td style="border-top: 3px solid #292524; padding-bottom: 4px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding: 32px 36px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 12px; font-style: italic; color: #a8a29e;">The Only Newspaper Worth Sitting Down For</span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; color: #d6d3d1;">&mdash; &bull; &mdash;</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #c7c2bc;">poopinpapers.com</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Button helper ────────────────────────────────────────────────────

function emailButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
  <tr>
    <td align="center" style="background-color: #1c1917; border-radius: 6px;">
      <a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">${label}</a>
    </td>
  </tr>
</table>`
}

// ── Divider helper ───────────────────────────────────────────────────

function emailDivider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="border-top: 1px solid #e7e5e4;"></td>
    <td width="40" align="center" style="padding: 0 12px;">
      <span style="font-size: 14px; color: #d6d3d1;">&#x1F9FB;</span>
    </td>
    <td style="border-top: 1px solid #e7e5e4;"></td>
  </tr>
</table>`
}

// ── Step row helper ──────────────────────────────────────────────────

function emailStep(num: string, emoji: string, title: string, desc: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
  <tr>
    <td width="48" valign="top" style="padding-top: 2px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 36px; height: 36px; border-radius: 18px; background-color: #1c1917; text-align: center; line-height: 36px;">
            <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #ffffff;">${num}</span>
          </td>
        </tr>
      </table>
    </td>
    <td valign="top" style="padding-left: 4px;">
      <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: bold; color: #1c1917; margin: 0 0 3px; line-height: 1.3;">
        ${emoji} ${title}
      </p>
      <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #57534e; margin: 0;">
        ${desc}
      </p>
    </td>
  </tr>
</table>`
}

// ── Templates ────────────────────────────────────────────────────────

export function buildPreviewEmailHtml(familyName: string, previewUrl: string) {
  return emailLayout(`
    <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1c1917; margin: 0 0 4px; line-height: 1.3;">
      The ${familyName} Edition
    </h1>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 1.5px;">
      Saturday Preview
    </p>

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 8px;">
      This week's paper is hot off the press and ready for your review.
    </p>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0;">
      Take a look, make any tweaks you'd like, and we'll deliver the final version tomorrow morning.
    </p>

    ${emailButton(previewUrl, 'Preview &amp; Edit &rarr;')}

    ${emailDivider()}

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.6; color: #a8a29e; margin: 0;">
      No changes needed? We'll send it as-is tomorrow at 8 AM.
    </p>
  `)
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
    html: buildPreviewEmailHtml(familyName, previewUrl),
  })
}

export function buildEditionReviewEmailHtml(
  editionId: string,
  weekStart: string,
  issueNumber: number
) {
  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://poopinpapers.com'}/admin/editions/${editionId}`

  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
      <tr>
        <td>
          <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1c1917; margin: 0 0 4px; line-height: 1.3;">
            New Edition Ready
          </h1>
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0; text-transform: uppercase; letter-spacing: 1.5px;">
            Admin Review
          </p>
        </td>
        <td align="right" valign="top">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color: #faf8f3; border: 1px solid #e7e5e4; border-radius: 6px; padding: 8px 14px; text-align: center;">
                <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; color: #a8a29e; text-transform: uppercase; letter-spacing: 1px;">Issue</span><br>
                <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1c1917;">#${issueNumber}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 8px;">
      Edition #${issueNumber} for the week of <strong>${weekStart}</strong> has been generated and is waiting for your review.
    </p>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0;">
      Review the content, edit or regenerate any sections, then approve it.
    </p>

    ${emailButton(reviewUrl, 'Review Edition &rarr;')}

    ${emailDivider()}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="4" style="background-color: #d6d3d1; border-radius: 2px;"></td>
        <td style="padding: 8px 0 8px 14px;">
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.5; color: #a8a29e; margin: 0;">
            If you don't review it by Saturday morning, it will be auto-approved and sent to subscribers as-is.
          </p>
        </td>
      </tr>
    </table>
  `)
}

export async function sendEditionReviewEmail(
  to: string,
  editionId: string,
  weekStart: string,
  issueNumber: number
) {
  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: `Edition #${issueNumber} is ready for review`,
    html: buildEditionReviewEmailHtml(editionId, weekStart, issueNumber),
  })
}

export function buildFinalEmailHtml(
  familyName: string,
  riddleAnswer?: string | null
) {
  const riddleHtml = riddleAnswer
    ? `${emailDivider()}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background-color: #faf8f3; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px 20px;">
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; color: #a8a29e; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px;">
              This Week's Riddle Answer
            </p>
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; color: #1c1917; margin: 0;">
              ${riddleAnswer}
            </p>
          </td>
        </tr>
      </table>`
    : ''

  return emailLayout(`
    <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1c1917; margin: 0 0 4px; line-height: 1.3;">
      The ${familyName} Edition
    </h1>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 1.5px;">
      Sunday Delivery
    </p>

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 8px;">
      This week's paper is attached and ready to print.
    </p>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0;">
      Hang it up, gather the family, and enjoy!
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
      <tr>
        <td style="background-color: #faf8f3; border: 1px dashed #d6d3d1; border-radius: 8px; padding: 20px; text-align: center;">
          <span style="font-size: 24px; line-height: 1;">&#x1F4CE;</span>
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #44403c; margin: 8px 0 2px;">
            PDF Attached
          </p>
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #a8a29e; margin: 0;">
            Print at full size for best results
          </p>
        </td>
      </tr>
    </table>

    ${riddleHtml}
  `)
}

export async function sendFinalEmail(
  to: string,
  familyName: string,
  pdfBuffer: Buffer,
  weekStart: string,
  riddleAnswer?: string | null
) {
  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: "This week's Poopin' Papers are here!",
    html: buildFinalEmailHtml(familyName, riddleAnswer),
    attachments: [
      {
        filename: `poopin-papers-${weekStart}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}

// ── Welcome Email ────────────────────────────────────────────────────

export function buildWelcomeEmailHtml(familyName: string, paperUrl: string) {
  return emailLayout(`
    <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: bold; color: #1c1917; margin: 0 0 4px; line-height: 1.3;">
      Welcome to Poopin' Papers!
    </h1>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 24px; text-transform: uppercase; letter-spacing: 1.5px;">
      The ${familyName} Edition
    </p>

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 8px;">
      You just signed up for a weekly family newspaper that gets printed and hung where everyone will actually read it.
    </p>
    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 24px;">
      Here's how it all works.
    </p>

    ${emailDivider()}

    <!-- How It Works -->
    <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 2px; font-weight: normal;">
      Your Weekly Rhythm
    </h2>

    ${emailStep('1', '&#x1F4F0;', 'We write your paper', 'Each week, we generate a fresh edition with meal plans, chores, family coaching, jokes, brain teasers, and more &mdash; all personalized for your family.')}

    ${emailStep('2', '&#x2709;&#xFE0F;', 'Saturday: Preview arrives', 'On Saturday morning, you\'ll get an email with a link to preview the paper. Read it over, and if anything needs changing, just tell us.')}

    ${emailStep('3', '&#x1F4AC;', 'Edit with chat', 'Want to swap a meal? Change the chores? Just type what you want in the chat bar and we\'ll update the paper in seconds. No menus, no forms &mdash; just say it.')}

    ${emailStep('4', '&#x1F4E8;', 'Sunday: Final delivery', 'Sunday morning, the finished PDF lands in your inbox. Print it, hang it up, and the whole family is on the same page &mdash; literally.')}

    ${emailDivider()}

    <!-- What's Inside -->
    <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 2px; font-weight: normal;">
      What's In Your Paper
    </h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
      <tr>
        <td style="padding: 10px 14px; background-color: #faf8f3; border-radius: 6px; margin-bottom: 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F4C5; <strong>This Week</strong> &mdash; Upcoming events, reminders, and what's on deck
              </td>
            </tr>
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F37D;&#xFE0F; <strong>Meal Plan</strong> &mdash; A full week of dinners, ready to go
              </td>
            </tr>
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F9F9; <strong>Chores</strong> &mdash; Who's doing what this week, spelled out
              </td>
            </tr>
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F4AA; <strong>Parent Coaching</strong> &mdash; A weekly tip to make family life smoother
              </td>
            </tr>
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F389; <strong>Fun Zone</strong> &mdash; Jokes, trivia, and things to make everyone smile
              </td>
            </tr>
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #44403c; padding: 4px 0;">
                &#x1F9E0; <strong>Brain Fuel</strong> &mdash; Riddles, puzzles, and things to think about
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.6; color: #a8a29e; margin: 8px 0 0;">
      You can turn sections on or off anytime in Settings.
    </p>

    ${emailDivider()}

    <!-- Tips -->
    <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #a8a29e; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: normal;">
      Pro Tips
    </h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
      <tr>
        <td width="4" style="background-color: #d6d3d1; border-radius: 2px;"></td>
        <td style="padding: 6px 0 6px 14px;">
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #57534e; margin: 0;">
            <strong style="color: #1c1917;">Hang it in the bathroom.</strong> That's the whole idea. It goes where people actually spend time reading.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
      <tr>
        <td width="4" style="background-color: #d6d3d1; border-radius: 2px;"></td>
        <td style="padding: 6px 0 6px 14px;">
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #57534e; margin: 0;">
            <strong style="color: #1c1917;">Talk to the editor.</strong> The chat bar is your direct line. "Add taco night on Thursday" or "Make the coaching tip about screen time" &mdash; just say it naturally.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
      <tr>
        <td width="4" style="background-color: #d6d3d1; border-radius: 2px;"></td>
        <td style="padding: 6px 0 6px 14px;">
          <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #57534e; margin: 0;">
            <strong style="color: #1c1917;">Check Saturday's preview.</strong> That's your window to make edits before the final version goes out Sunday.
          </p>
        </td>
      </tr>
    </table>

    ${emailDivider()}

    <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; color: #44403c; margin: 0 0 4px;">
      Your first issue is being put together right now. Go take a look!
    </p>

    ${emailButton(paperUrl, 'View Your Paper &rarr;')}
  `)
}

export async function sendWelcomeEmail(
  to: string,
  familyName: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://poopinpapers.com'
  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: `Welcome to Poopin' Papers, ${familyName}!`,
    html: buildWelcomeEmailHtml(familyName, `${appUrl}/paper`),
  })
}
