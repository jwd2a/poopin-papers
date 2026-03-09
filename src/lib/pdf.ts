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

// Cache embedded font CSS so we only fetch once per cold start
let _fontCssCache: string | null = null

/**
 * Fetch Google Fonts CSS, then fetch each woff2 file referenced in it,
 * convert to base64 data URIs, and return fully self-contained CSS.
 * This avoids any network dependency from Chromium.
 */
async function getEmbeddedFontCss(): Promise<string> {
  if (_fontCssCache) return _fontCssCache

  try {
    // Fetch font CSS (use woff2 user-agent to get woff2 format)
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Color+Emoji&display=swap'
    const cssRes = await fetch(cssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })
    let css = await cssRes.text()

    // Find all url() references and replace with data URIs
    const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g
    const matches = [...css.matchAll(urlRegex)]

    for (const match of matches) {
      const fontUrl = match[1]
      try {
        const fontRes = await fetch(fontUrl)
        const buffer = await fontRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = fontUrl.endsWith('.woff2') ? 'font/woff2' : 'font/woff'
        css = css.replace(fontUrl, `data:${mimeType};base64,${base64}`)
      } catch {
        // If a single font file fails, skip it
        console.warn(`Failed to fetch font: ${fontUrl}`)
      }
    }

    _fontCssCache = css
    return css
  } catch (err) {
    console.error('Failed to fetch Google Fonts:', err)
    return '' // Graceful degradation — fonts will fall back to system defaults
  }
}

function injectFonts(html: string, fontCss: string): string {
  const style = `<style>${fontCss}
    * { font-family: 'Noto Serif', Georgia, 'Times New Roman', serif !important; }
  </style>`

  if (html.includes('</head>')) {
    return html.replace('</head>', style + '</head>')
  }
  if (html.includes('<body')) {
    return html.replace('<body', style + '<body')
  }
  return style + html
}

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()

    // Embed fonts as base64 data URIs — no network needed from Chromium
    const fontCss = await getEmbeddedFontCss()
    const fontHtml = injectFonts(html, fontCss)

    await page.setContent(fontHtml, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.evaluate(() => document.fonts.ready)

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
