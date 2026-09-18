import { execSync } from 'child_process'
import { existsSync } from 'fs'

const git = 'C:\\Program Files\\Git\\cmd\\git.exe'
console.log('git exists', existsSync(git))
if (existsSync(git)) {
  console.log(execSync(`"${git}" --version`, { encoding: 'utf8' }).trim())
}
try {
  console.log(execSync('gh auth status', { encoding: 'utf8' }).trim())
} catch (e) {
  console.log('gh:', String(e.stderr || e.message).slice(0, 300))
}
