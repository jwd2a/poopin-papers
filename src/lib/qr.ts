import QRCode from 'qrcode'

/**
 * Generate a QR code as a base64 data URI and return an HTML block
 * to inject into the newsletter before the footer.
 */
export async function buildIntranetBlock(url: string): Promise<string> {
  const dataUri = await QRCode.toDataURL(url, {
    width: 64,
    margin: 1,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  })

  // Extract display name from URL (strip protocol, trailing slash)
  const displayUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

  return `<div style="border:1.5px solid #333;border-radius:4px;padding:6px 10px;margin-top:6px;display:flex;align-items:center;gap:10px;background:#fafaf5;">
  <img src="${dataUri}" alt="QR Code" style="width:54px;height:54px;image-rendering:pixelated;" />
  <div style="font-size:9pt;line-height:1.35;">
    <div style="font-weight:bold;">\uD83D\uDCE1 Visit ${displayUrl}</div>
    <div style="color:#444;">Weekly menus, announcements, how-to guides &amp; more \u2014 all on our family intranet!</div>
    <div style="color:#888;font-size:8pt;font-style:italic;">Scan the QR code while on home WiFi</div>
  </div>
</div>`
}

/**
 * Inject the intranet block into composed HTML, right before the footer.
 */
export async function injectIntranetBlock(html: string, url: string): Promise<string> {
  const block = await buildIntranetBlock(url)

  // Insert before the footer div
  if (html.includes('<div class="footer"')) {
    return html.replace('<div class="footer"', block + '<div class="footer"')
  }

  // Fallback: insert before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', block + '</body>')
  }

  return html + block
}
