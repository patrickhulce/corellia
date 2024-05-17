import {runNflCrawl} from '../src/nfl/nfl'

async function main() {
  const username = process.env.NFL_USERNAME
  const password = process.env.NFL_PASSWORD
  const userDataDir = process.env.NFL_USER_DATA_DIR
  const pathToSavedGames = process.env.NFL_PATH_TO_SAVED_GAMES
  const ytDlpExecutable = process.env.NFL_YT_DLP_EXECUTABLE

  if (!username || !password) {
    throw new Error('Please provide NFL_USERNAME and NFL_PASSWORD environment variables')
  }

  if (!pathToSavedGames) {
    throw new Error('Please provide NFL_PATH_TO_SAVED_GAMES environment variable')
  }

  if (!userDataDir) {
    throw new Error('Please provide NFL_USER_DATA_DIR environment variable')
  }

  if (!ytDlpExecutable) {
    throw new Error('Please provide NFL_YT_DLP_EXECUTABLE environment variable')
  }

  await runNflCrawl({
    username,
    password,
    pathToSavedGames,
    userDataDir,
    ytDlpExecutable,
    targetResolution: '1080p',
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
