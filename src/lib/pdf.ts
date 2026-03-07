import puppeteer, { type Browser } from 'puppeteer-core'

const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL

async function launchBrowser(): Promise<Browser> {
  if (IS_LAMBDA) {
    const chromium = await import('@sparticuz/chromium')
    return puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.default.executablePath(),
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

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const pdf = await page.pdf({
    format: 'letter',
    printBackground: true,
  })

  await browser.close()
  return Buffer.from(pdf)
}

/** Render HTML to a letter-size PNG screenshot for visual QA */
export async function screenshotHTML(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  // Set viewport to letter proportions at 1.5x for readable screenshot
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1.5 })
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 816, height: 1056 },
  })

  await browser.close()
  return Buffer.from(screenshot)
}
