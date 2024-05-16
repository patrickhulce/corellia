import {spawn} from 'node:child_process'

const STREAM_REGEX = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+).*\n(https?.*?\.m3u8.*)/g

export function parseM3U8(m3u8Content: string): {resolution: string; url: string}[] {
  const matches = Array.from(m3u8Content.matchAll(STREAM_REGEX))
  return matches.map(match => {
    const resolution = match[1]
    const url = match[2]
    return {resolution, url}
  })
}

export async function downloadVideo(m3u8url: string, output: string, ytDlpExecutable: string) {
  const args = [m3u8url, '-o', output]

  console.log('Running yt-dlp with args:', args)
  const ytDlp = spawn(ytDlpExecutable, args)
  ytDlp.stdout.pipe(process.stdout)
  ytDlp.stderr.pipe(process.stderr)

  await new Promise<void>((resolve, reject) => {
    ytDlp.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`))
      }
    })
  })
}

export async function convertVideoTo12fps(input: string, output: string) {
  const args = ['-i', input, '-vf', 'fps=12', '-c:a', 'copy', output]

  console.log('Running ffmpeg with args:', args)
  const ffmpeg = spawn('ffmpeg', args)
  ffmpeg.stdout.pipe(process.stdout)
  ffmpeg.stderr.pipe(process.stderr)

  await new Promise<void>((resolve, reject) => {
    ffmpeg.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
  })
}

export async function convertVideoTo540p(input: string, output: string) {
  const args = [
    '-i',
    input,
    '-c:v',
    'libx264',
    '-vf',
    'scale=960:540:flags=lanczos',
    '-crf',
    '23',
    // Drop audio
    '-an',
    output,
  ]

  console.log('Running ffmpeg with args:', args)
  const ffmpeg = spawn('ffmpeg', args)
  ffmpeg.stdout.pipe(process.stdout)
  ffmpeg.stderr.pipe(process.stderr)

  await new Promise<void>((resolve, reject) => {
    ffmpeg.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
  })
}
