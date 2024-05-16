import * as fs from 'fs'
import * as path from 'path'
import {chromium, Page, Response} from 'playwright'
import * as locators from './locators'
import {NflSavedGame, NflMainOptions, NflCrawlState, VideoType, Week} from './types'
import waitForExpect from 'wait-for-expect'
import {downloadVideo, parseM3U8} from './m3u8'

function gameSaveToFilename(game: NflSavedGame, extension: string = 'json') {
  return `${game.season}-${game.week.replace(/\s+/g, '')}-${game.awayTeam}-at-${
    game.homeTeam
  }.${extension}`
}

function loadState(options: NflMainOptions): NflCrawlState {
  return {
    savedGames: fs
      .readdirSync(options.pathToSavedGames)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(options.pathToSavedGames, f), 'utf-8'))),
  }
}

async function waitForSignInOrProfile(page: Page): Promise<{isLoggedIn: boolean}> {
  const signInOrProfile = await Promise.race([
    page.waitForSelector('text="Sign In"', {timeout: 60_000}),
    page.waitForSelector('*[data-is-logged-in]', {timeout: 60_000}),
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

async function selectTargetDownloadWeek(page: Page) {
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

  // Select season and week from dropdowns
  const targetWeek = Week.Week1
  await page.goto(locators.createWeekUrl('2023', targetWeek))
  await page.waitForSelector(`text="Replay ${targetWeek}"`)
  await page.waitForTimeout(1_000)
}

async function selectNextGame(page: Page): Promise<NflSavedGame | undefined> {
  console.log('Selecting game...')
  const gameCards = await locators.gameCard(page)

  const games = await Promise.all(
    (
      await gameCards.all()
    ).map(async gameCard => {
      return [
        gameCard,
        await locators.extractGameInfo(gameCard, {season: '2023', week: Week.Week1}),
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

  console.log('navigating to game...')
  await page.waitForTimeout(3_000)

  const url = await locators.createGameUrl(games[0][1])
  console.log('Navigating to:', url)
  await page.goto(url, {waitUntil: 'domcontentloaded'})

  return games[0][1]
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
    throw new Error('Could not find the 1080p resolution')
  }

  const videoFilename = gameSaveToFilename(game, 'mp4')
  game.videoFilename = videoFilename
  game.resolution = '1080p'
  const videoPath = path.join(options.pathToSavedGames, videoFilename)
  const jsonPath = path.join(options.pathToSavedGames, gameSaveToFilename(game, 'json'))
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
  await selectTargetDownloadWeek(page)
  const game = await selectNextGame(page)
  if (!game) {
    throw new Error('No games found')
  }
  await downloadGame(page, game, options)

  await context.close()
  await browser.close()
}
