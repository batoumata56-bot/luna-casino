import { spawn } from 'child_process'
import { writeFileSync } from 'fs'

const child = spawn('npx', ['--yes', 'vercel', 'login'], {
  cwd: process.cwd(),
  shell: true,
  env: process.env,
})

let buf = ''
child.stdout.on('data', (d) => {
  const s = d.toString()
  buf += s
  process.stdout.write(s)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  buf += s
  process.stderr.write(s)
})
child.on('close', (code) => {
  writeFileSync('scripts/vercel-login-out.txt', buf)
  console.log('exit', code)
})

// Keep alive for browser login
setTimeout(() => {}, 180000)
