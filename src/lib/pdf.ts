import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: true,
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
