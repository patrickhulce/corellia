import { spawn } from 'child_process'

const PORT = 5173

const vite = spawn('npx', ['vite', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: true,
})

vite.on('error', (err) => {
  console.error('Failed to start vite:', err)
  process.exit(1)
})

const tunnel = spawn('ngrok', ['http', String(PORT)], { stdio: 'ignore' })

tunnel.on('error', (err) => {
  console.error('Failed to start ngrok:', err)
  process.exit(1)
})

// Poll ngrok's local API until the tunnel is up
const url = await new Promise((resolve, reject) => {
  let attempts = 0
  const interval = setInterval(async () => {
    try {
      const res = await fetch('http://localhost:4040/api/tunnels')
      const { tunnels } = await res.json()
      const public_url = tunnels.find((t) => t.proto === 'https')?.public_url
      if (public_url) {
        clearInterval(interval)
        resolve(public_url)
      }
    } catch {
      // ngrok not ready yet
    }
    if (++attempts > 30) {
      clearInterval(interval)
      reject(new Error('ngrok tunnel did not start in time'))
    }
  }, 500)
})

console.log(`\n  ngrok tunnel: ${url}\n`)

process.on('SIGINT', () => {
  tunnel.kill()
  vite.kill()
  process.exit(0)
})
