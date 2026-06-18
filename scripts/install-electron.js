const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (!fs.existsSync(path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe'))) {
  console.log('Downloading Electron binary...')
  execSync('node node_modules/electron/install.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
    }
  })
}
