import { existsSync } from 'fs'
import { execSync } from 'child_process'

const gitCandidates = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
]

for (const p of gitCandidates) {
  console.log(p, existsSync(p) ? 'EXISTS' : 'missing')
}

try {
  const out = execSync('npx --yes vercel whoami', {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  console.log('vercel whoami:', out.trim())
} catch (e) {
  console.log('vercel whoami failed')
  console.log(String(e.stderr || e.stdout || e.message).slice(0, 500))
}
