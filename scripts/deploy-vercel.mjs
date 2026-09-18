import { execSync } from 'child_process'

console.log('Building...')
execSync('npm run build', { stdio: 'inherit' })

console.log('Deploying to Vercel production...')
const out = execSync('npx --yes vercel deploy --prod --yes --name luna-casino', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 300000,
})
console.log(out)
