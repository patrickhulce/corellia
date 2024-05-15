import {runNflCrawl} from '../src/nfl/nfl'

async function main() {
  const username = process.env.NFL_USERNAME
  const password = process.env.NFL_PASSWORD
  const pathToSavedGames = process.env.NFL_PATH_TO_SAVED_GAMES

  if (!username || !password) {
    throw new Error('Please provide NFL_USERNAME and NFL_PASSWORD environment variables')
  }

  if (!pathToSavedGames) {
    throw new Error('Please provide NFL_PATH_TO_SAVED_GAMES environment variable')
  }

  await runNflCrawl({username, password, pathToSavedGames})
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
