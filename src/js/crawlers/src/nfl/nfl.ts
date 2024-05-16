import * as fs from 'fs'
import * as path from 'path'
import * as _ from 'lodash'
import {chromium, Page, Response} from 'playwright'
import * as locators from './locators'
import {NflSavedGame, NflMainOptions, NflCrawlState, VideoType, Week, SEASONS, WEEKS} from './types'
import waitForExpect from 'wait-for-expect'
import {downloadVideo, parseM3U8} from './m3u8'

function loadSavedGames(options: NflMainOptions): NflSavedGame[] {
  return fs
    .readdirSync(options.pathToSavedGames)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(options.pathToSavedGames, f), 'utf-8')))
}

function loadState(options: NflMainOptions): NflCrawlState {
  return {
    savedGames: loadSavedGames(options),

    currentSeason: undefined,
    currentWeek: undefined,
  }
}

async function waitForSignInOrProfile(page: Page): Promise<{isLoggedIn: boolean}> {
  const signInOrProfile = await Promise.race([
    page.waitForSelector('text="Sign In"'),
    page.waitForSelector('*[data-is-logged-in]'),
  ])
  if (!signInOrProfile) {
    throw new Error('Could not find either button')
  }

  const text = await signInOrProfile.textContent()
  console.log('Sign In or Profile text:', text)
  return {isLoggedIn: !text?.includes('Sign In')}
}

async function logInToNflPlus(page: Page, options: NflMainOptions) {
  // Navigate to NFL.com
  await page.goto('https://www.nfl.com/plus/replays', {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(1_000)
  await page.click('text="Accept Cookies"')
  await page.waitForTimeout(1_000)
  await page.waitForLoadState('domcontentloaded')

  const {isLoggedIn} = await waitForSignInOrProfile(page)
  if (isLoggedIn) {
    console.log('Already logged in')
    return
  }

  console.log('Logging in...')
  // Click on the "Sign In" button
  await page.click('text="Sign In"')

  await page.waitForURL(/id\.nfl\.com/)

  // Enter username and click continue
  await page.fill('input[type="email"]', options.username)
  await page.waitForTimeout(1_000)
  await page.click('text="Continue"')

  // Enter password and click continue
  await page.fill('input[autocomplete="current-password"]', options.password)
  await page.waitForTimeout(1_000)
  await Promise.all([page.click('text="Sign In"'), page.waitForURL(/www\.nfl\.com\/plus/)])

  await page.waitForSelector('*[data-is-logged-in]')
}

async function selectTargetDownloadWeek(page: Page, state: NflCrawlState): Promise<void> {
  // If not already on the replays page, navigate to it.
  const currentUrl = page.url()
  if (!currentUrl.includes('/plus/replays')) {
    console.log('URL was:', currentUrl, 'Navigating to replays page...')
    await page.goto('https://www.nfl.com/plus/replays')
  }

  console.log('Waiting for page load to complete...')
  const {isLoggedIn} = await waitForSignInOrProfile(page)
  if (!isLoggedIn) {
    console.log('Not logged in, waiting for 2 minutes...')
    await new Promise(r => setTimeout(r, 120_000))
    throw new Error('Not logged in, week selection is not possible')
  }

  console.log('Selecting target download week...')
  // Figure out where we left off (the season with fewest saved games, latest week in that season).
  const savedGamesBySeason = state.savedGames.reduce((acc, game) => {
    if (!acc[game.season]) {
      acc[game.season] = []
    }
    acc[game.season].push(game)
    return acc
  }, {} as Record<string, NflSavedGame[]>)

  const seasons = Object.keys(savedGamesBySeason)
  const seasonWithFewestGames = _.minBy(seasons, s => savedGamesBySeason[s].length) || SEASONS[0]
  const gamesOfSeason = savedGamesBySeason[seasonWithFewestGames] || []
  const latestWeek = _.maxBy(gamesOfSeason, g => WEEKS.indexOf(g.week))?.week || Week.Week1

  state.currentSeason = seasonWithFewestGames
  state.currentWeek = latestWeek

  console.log('Season with fewest games:', seasonWithFewestGames)
  console.log('Latest week:', latestWeek)
}

async function selectNextGame(page: Page, state: NflCrawlState): Promise<NflSavedGame | undefined> {
  if (!state.currentSeason || !state.currentWeek) {
    throw new Error('Current season or week is not set')
  }

  console.log('Navigating to week...')
  await page.goto(locators.createWeekUrl(state.currentSeason, state.currentWeek))
  await page.waitForSelector(`text="Replay ${state.currentWeek}"`)
  await page.waitForTimeout(1_000)

  console.log('Selecting game...')
  const gameCards = await locators.gameCard(page)

  const games = await Promise.all(
    (
      await gameCards.all()
    ).map(async gameCard => {
      return [
        gameCard,
        await locators.extractGameInfo(gameCard, {
          season: state.currentSeason!,
          week: state.currentWeek!,
        }),
      ] as const
    }),
  )

  console.log('Available games:', games)

  if (games.length === 0) {
    throw new Error('No games found')
  }

  const {isLoggedIn} = await waitForSignInOrProfile(page)
  if (!isLoggedIn) {
    console.log('Not logged in, waiting for 2 minutes...')
    await new Promise(r => setTimeout(r, 120_000))
    throw new Error('Not logged in, game navigation is not possible')
  }

  // Find the first game that hasn't been saved yet.
  const savedGameFiles = new Set(state.savedGames.map(g => g.videoFilename))
  console.log('Saved game files:', savedGameFiles)
  const unsavedGames = games.filter(g => !savedGameFiles.has(g[1].videoFilename))
  console.log('Unsaved games:', unsavedGames)

  if (unsavedGames.length === 0) {
    console.log('No unsaved games found, moving on...')
    const nextWeekIndex = WEEKS.indexOf(state.currentWeek!) + 1
    if (nextWeekIndex >= WEEKS.length) {
      const nextSeasonIndex = SEASONS.indexOf(state.currentSeason!) + 1
      if (nextSeasonIndex >= SEASONS.length) {
        console.log('No more games to download')
        return
      }
      state.currentSeason = SEASONS[nextSeasonIndex]
      state.currentWeek = WEEKS[0]
    } else {
      state.currentWeek = WEEKS[nextWeekIndex]
    }
    return
  }

  const targetGame = unsavedGames[0][1]
  console.log(`Navigating to game ${targetGame.awayTeam} at ${targetGame.homeTeam}...`)
  await page.waitForTimeout(3_000)

  const url = await locators.createGameUrl(targetGame)
  console.log('Navigating to:', url)
  await page.goto(url, {waitUntil: 'domcontentloaded'})

  return targetGame
}

async function downloadGame(page: Page, game: NflSavedGame, options: NflMainOptions) {
  const {isLoggedIn} = await waitForSignInOrProfile(page)
  if (!isLoggedIn) {
    console.log('Not logged in, waiting for 2 minutes...')
    await new Promise(r => setTimeout(r, 120_000))
    throw new Error('Not logged in, game navigation is not possible')
  }

  // List available game types.
  await waitForExpect(async () => {
    const videos = await locators.extractAvailableVideos(page)
    const selectedVideo = videos.find(v => v.selected)
    if (!selectedVideo) {
      throw new Error(`No video selected: ${JSON.stringify(videos)}`)
    }
  })

  console.log('Extracting available videos...')
  const availableVideos = await locators.extractAvailableVideos(page)
  console.log('Available videos:', availableVideos)

  // Select the all-22 video
  const all22Video = availableVideos.find(v => v.type === VideoType.All22)
  if (!all22Video) {
    throw new Error('Could not find the All-22 video')
  }

  if (all22Video.selected) {
    throw new Error('All-22 video is already selected')
  }

  console.log('Waiting for video to be ready...')
  await page.waitForTimeout(3_000)

  const m3u8responses: Response[] = []

  page.on('response', response => {
    if (response.url().includes('.m3u8')) {
      m3u8responses.push(response)
    }
  })

  console.log('Clicking on the All-22 video, waiting for master.m3u8...')
  const [_, m3u8response] = await Promise.all([
    all22Video.locator.click(),
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('master.m3u8')),
  ])

  console.log('Master M3U8 response URL:', m3u8response.url())
  console.log('Waiting for video to be selected...')
  await waitForExpect(async () => {
    const videos = await locators.extractAvailableVideos(page)
    const selectedVideo = videos.find(v => v.selected)
    if (selectedVideo?.type !== VideoType.All22) {
      throw new Error(`All22 Not selected: ${JSON.stringify(videos)}`)
    }
  })

  console.log('Extracting available resolutions...')
  const masterM3u8 = await m3u8response.text()
  console.log('Master M3U8:\n', masterM3u8)
  const streams = parseM3U8(masterM3u8)
  console.log(streams)

  const hdResolution = streams.find(s => s.resolution === '1920x1080')
  if (!hdResolution) {
    console.log('HD resolution not found, skipping...')
    return
  }

  const videoFilename = locators.gameSaveToFilename(game, 'mp4')
  game.videoFilename = videoFilename
  game.resolution = '1080p'
  const videoPath = path.join(options.pathToSavedGames, videoFilename)
  const jsonPath = path.join(options.pathToSavedGames, locators.gameSaveToFilename(game, 'json'))
  if (fs.existsSync(videoPath)) {
    if (fs.existsSync(jsonPath)) {
      console.log('Game already downloaded, skipping...')
      return
    }

    console.log('Game video exists, but JSON file is missing, re-downloading...')
    fs.unlinkSync(videoPath)
  }

  console.log('Downloading video to:', videoPath)
  await downloadVideo(hdResolution.url, videoPath, options.ytDlpExecutable)
  console.log('Download complete!')

  fs.writeFileSync(jsonPath, JSON.stringify(game))
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

  await logInToNflPlus(page, options)

  // Load existing saved games.
  const state = loadState(options)

  // Figure out the next season and week to look at.
  await selectTargetDownloadWeek(page, state)

  while (true) {
    // Download all games for the target week we haven't seen yet.
    state.savedGames = loadSavedGames(options)
    const game = await selectNextGame(page, state)
    if (!game) break
    await downloadGame(page, game, options)
  }

  await context.close()
  await browser.close()
}
