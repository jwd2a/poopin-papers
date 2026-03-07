import { screenshotHTML } from '../src/lib/pdf'
import fs from 'fs'

async function main() {
  const html = fs.readFileSync('/tmp/new-paper.html', 'utf-8')
  console.log('Taking screenshot...')
  const screenshot = await screenshotHTML(html)
  fs.writeFileSync('/tmp/paper-screenshot.png', screenshot)
  console.log('Saved to /tmp/paper-screenshot.png')
}

main().catch(console.error)
