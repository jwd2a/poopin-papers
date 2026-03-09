import puppeteer, { type Browser } from 'puppeteer-core'

const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL

async function launchBrowser(): Promise<Browser> {
  if (IS_LAMBDA) {
    const chromium = await import('@sparticuz/chromium-min')
    const executablePath = await chromium.default.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
    )
    return puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    })
  }

  // Local dev — use system Chrome
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ]

  let executablePath: string | undefined
  for (const p of possiblePaths) {
    try {
      const fs = await import('fs')
      if (fs.existsSync(p)) { executablePath = p; break }
    } catch { /* ignore */ }
  }

  if (!executablePath) {
    throw new Error('No Chrome installation found for local dev. Install Google Chrome.')
  }

  return puppeteer.launch({
    executablePath,
    defaultViewport: { width: 1280, height: 720 },
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

// Strip emoji characters that serverless Chromium can't render
function stripEmoji(html: string): string {
  // Match emoji Unicode ranges (covers most common emoji)
  return html.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
}

// Inject web font so serverless Chromium renders serif fonts correctly
function preparePdfHtml(html: string): string {
  const cleaned = stripEmoji(html)
  const fontLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
    <style>
      body, html { font-family: 'Noto Serif', Georgia, 'Times New Roman', serif !important; }
    </style>
  `
  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', fontLinks + '</head>')
  }
  return fontLinks + cleaned
}

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    const pdfHtml = preparePdfHtml(html)
    await page.setContent(pdfHtml, { waitUntil: 'networkidle0', timeout: 15000 })

    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

/** Render HTML to a letter-size PNG screenshot for visual QA */
export async function screenshotHTML(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1.5 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 })

    // Small delay for fonts/layout to settle
    await new Promise(r => setTimeout(r, 300))

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 816, height: 1056 },
    })

    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}
