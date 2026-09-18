import { execSync, spawnSync } from 'child_process'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const key = 'VITE_SUPABASE_ANON_KEY'
spawnSync('npx', ['--yes', 'vercel', 'env', 'rm', key, 'production', '--yes'], {
  shell: true,
  stdio: 'inherit',
})

const r = spawnSync(
  'npx',
  [
    '--yes',
    'vercel',
    'env',
    'add',
    key,
    'production',
    '--type',
    'config',
    '--value',
    env[key],
    '--yes',
  ],
  { shell: true, encoding: 'utf8' },
)
console.log(r.stdout || '')
console.log(r.stderr || '')
if (r.status !== 0) process.exit(r.status || 1)

console.log('Redeploying...')
const out = execSync('npx --yes vercel deploy --prod --yes', {
  encoding: 'utf8',
  timeout: 300000,
})
console.log(out)
