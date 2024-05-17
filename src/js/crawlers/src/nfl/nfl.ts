import * as fs from 'fs'
import * as path from 'path'
import {chromium} from 'playwright'
import createLogger from 'debug'
import * as extractors from './extractors'
import {NflMainOptions, NflCrawlState, NflGameSave} from './types'
import {downloadAll22, logIn, navigateToGame, navigateToWeekReplays} from './actions'
import {
  computeLastSavedWeek,
  computeNextGameToDownload,
  computeNextWeekToDownload,
  hasDownloadedEveryGame,
} from './logic'

const log = createLogger('nfl:main')

function loadSavedGames(options: NflMainOptions): NflGameSave[] {
  return fs
    .readdirSync(options.pathToSavedGames)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(options.pathToSavedGames, f), 'utf-8')))
}

function loadState(options: NflMainOptions): NflCrawlState {
  const savedGames = loadSavedGames(options)
  const {season, week} = computeLastSavedWeek(savedGames)
  return {savedGames, season, week}
}

export async function runNflCrawl(options: NflMainOptions) {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36',
    permissions: ['geolocation'],
    timezoneId: 'America/Chicago',
    geolocation: {latitude: 41.881832, longitude: -87.623177}, // Chicago
  })

  context.setDefaultTimeout(120_000)
  const page = await context.newPage()

  let state = loadState(options)

  log(`login to NFL+`)
  await logIn(page, options)

  while (!hasDownloadedEveryGame(state.savedGames)) {
    await navigateToWeekReplays(page, state.season, state.week, options)

    const availableGameLocators = await extractors.extractAvailableGames(page)
    const availableGames = availableGameLocators.map(({game}) => game)
    const nextGame = computeNextGameToDownload(state.savedGames, availableGames)
    if (!nextGame) {
      const nextWeek = computeNextWeekToDownload({season: state.season, week: state.week})
      state = {...state, ...nextWeek}
      continue
    }

    await navigateToGame(page, nextGame, options)
    await downloadAll22(page, nextGame, options)
    state = loadState(options)
  }

  await context.close()
  await browser.close()
}
