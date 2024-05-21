import * as _ from 'lodash'
import createLogger from 'debug'
import {Locator, Page} from 'playwright'
import * as locators from './locators'
import * as extractors from './extractors'
import {
  NflGame,
  NflMainOptions,
  VideoType,
  Week,
  LoadingError,
  AuthError,
  createNflGameSave,
} from './types'
import waitForExpect from 'wait-for-expect'
import {computeVideoStreamToUse} from './logic'
import {downloadVideo} from './m3u8'
import path from 'path'
import fs from 'fs'

const log = createLogger('nfl:browser-actions')
const noop = () => {}

interface WaitForAuthStateOptions extends NflMainOptions {
  retryMethod?: () => Promise<void> | 'reload'
  maxRetries?: number
}

export async function waitForAuthState(
  page: Page,
  options: WaitForAuthStateOptions,
): Promise<{isLoggedIn: boolean}> {
  const {retryMethod = 'reload', maxRetries = 0} = options

  async function wait() {
    log('wait for auth state')
    const $signIn = locators.locateSignIn(page)
    const $profile = locators.locateMyProfile(page)

    try {
      await Promise.race([
        // Catch errors to prevent unhandled promise rejections.
        $signIn.waitFor({state: 'visible'}).catch(noop),
        $profile.waitFor({state: 'visible'}).catch(noop),
      ])
    } catch (err) {
      log('auth state timeout')
      throw new LoadingError('Failed to determine auth state')
    }

    const isLoggedIn = await $profile.isVisible()
    const isNotLoggedIn = await $signIn.isVisible()

    if (!isLoggedIn && !isNotLoggedIn) {
      // Case where both timed out but we caught the errors.
      throw new LoadingError('Failed to determine auth state')
    }

    return {isLoggedIn}
  }

  let attempts = 0
  while (attempts <= maxRetries) {
    try {
      if (attempts > 0) {
        if (retryMethod === 'reload') {
          log('attempting reload page')
          await page.reload({waitUntil: 'domcontentloaded'})
        } else {
          log('attempting retry method')
          await retryMethod()
        }
      }

      return await wait()
    } catch (err) {
      log(`auth state error: ${err}`)
      attempts++

      if (!(err instanceof LoadingError)) throw err
      if (attempts > maxRetries) throw err
    }
  }

  throw new LoadingError('Failed to determine auth state')
}

export async function assertAuthState(page: Page, options: WaitForAuthStateOptions) {
  const {isLoggedIn} = await waitForAuthState(page, options)
  if (!isLoggedIn) throw new AuthError('Page requires authentication')
}

export async function waitForLoginPage(page: Page) {
  log(`wait for id.nfl.com to load`)
  await page.waitForURL(/id\.nfl\.com/)
}

export async function waitForNflPlus(page: Page) {
  log(`wait for nfl.com/plus redirect to load`)
  await page.waitForURL(/www\.nfl\.com\/plus/)
}

export async function waitForVideoToSelect(
  page: Page,
  videoType: VideoType,
  options: NflMainOptions,
): Promise<void> {
  log(`wait for ${videoType} video to be selected`)
  await waitForExpect(async () => {
    const videos = await extractors.extractAvailableVideos(page)
    const selectedVideo = videos.find(v => v.selected)
    if (!selectedVideo) {
      throw new Error(`No video selected: ${JSON.stringify(videos)}`)
    }

    if (videoType === VideoType.Any) return
    if (videoType === selectedVideo.type) return

    throw new Error(`Wrong video selected. Expected: ${videoType}, got: ${selectedVideo.type}`)
  })
}

export async function waitForVideoToPlay(
  page: Page,
  $videoSelector: Locator,
  options: NflMainOptions,
): Promise<void> {}

export async function logIn(page: Page, options: NflMainOptions) {
  log(`navigate to replays for auth check`)
  await page.goto(locators.getReplaysUrl(), {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(1_000)

  const $cookies = locators.locateAcceptCookies(page)
  if (await $cookies.isVisible()) {
    await $cookies.click()
    await page.waitForTimeout(1_000)
    await page.waitForLoadState('domcontentloaded')
  }

  const authStateBefore = await waitForAuthState(page, options)
  const stateDescription = authStateBefore.isLoggedIn ? 'logged in' : 'anonymous'
  log(`user login state: ${stateDescription}`)

  if (authStateBefore.isLoggedIn) return

  log(`navigate to sign in`)
  await locators.locateSignIn(page).click()
  await waitForLoginPage(page)

  log(`fill username`)
  await page.fill('input[type="email"]', options.username)
  await page.click('text="Continue"')

  log(`fill password`)
  await page.fill('input[autocomplete="current-password"]', options.password)
  await page.click('text="Sign In"')

  log(`wait for auth redirect`)
  await waitForNflPlus(page)

  log(`wait for login confirmation`)
  const authStateAfter = await waitForAuthState(page, options)
  if (!authStateAfter.isLoggedIn) throw new Error(`Failed to sign in`)
}

export async function navigateToReplays(page: Page, options: NflMainOptions): Promise<void> {
  log(`navigate to replays page`)
  await page.goto(locators.getReplaysUrl(), {waitUntil: 'domcontentloaded'})
  await assertAuthState(page, {...options, maxRetries: 1})
}

export async function navigateToWeekReplays(
  page: Page,
  season: string,
  week: Week,
  options: NflMainOptions,
): Promise<void> {
  log(`navigate to week replays: ${season} - ${week}`)
  await page.goto(locators.getWeekUrl(season, week))
  await page.waitForSelector(`text="Replay ${week}"`)
  await assertAuthState(page, {...options, maxRetries: 1})
  await page.waitForSelector(`text="Replay ${week}"`)
  log(`navigated to week replays: ${season} - ${week}`)
}

export async function navigateToGame(
  page: Page,
  game: NflGame,
  options: NflMainOptions,
): Promise<void> {
  log(`navigate to game: ${game.season} ${game.week}, ${game.awayTeam} at ${game.homeTeam}`)
  await page.goto(locators.getGameUrl(game), {waitUntil: 'domcontentloaded'})
  await assertAuthState(page, options)
}

export async function selectVideoType(
  page: Page,
  videoType: VideoType,
  options: NflMainOptions,
): Promise<void> {
  log(`select video type: ${videoType}`)
  const $selector = await locators.locateVideoSelector(page, videoType)
  await $selector.click()
  await waitForVideoToSelect(page, videoType, options)
}

export async function downloadAll22(
  page: Page,
  game: NflGame,
  options: NflMainOptions,
): Promise<void> {
  const gameDisplay = `${game.week} ${game.awayTeam} @ ${game.homeTeam}`

  const availableVideos = await extractors.extractAvailableVideos(page)
  const all22Video = availableVideos.find(v => v.type === VideoType.All22)
  log(`${availableVideos.length} videos available for ${gameDisplay}`)
  if (!all22Video) {
    log(`no all-22 video available: ${gameDisplay}`)
    await markGameAsUnavailable(page, game, options)
    return
  }

  log(`extract all-22 m3u8 master: ${gameDisplay}`)
  const m3u8 = await extractors.extractAll22VideoM3u8(page, options)
  if (!m3u8) {
    log(`no all-22 m3u8 found: ${gameDisplay}`)
    await markGameAsUnavailable(page, game, options)
    return
  }

  const streamUrl = computeVideoStreamToUse(m3u8.entries, options)
  if (!streamUrl) {
    log(`no suitable stream found at desired resolution, skipping`)
    await markGameAsUnavailable(page, game, options)
    return
  }

  const gameSave = createNflGameSave(game)
  const videoPath = path.join(options.pathToSavedGames, gameSave.videoFilename)
  const jsonPath = videoPath.replace('.mp4', '.json')

  if (fs.existsSync(jsonPath)) {
    log(`metadata exists, skipping download of all-22 stream: ${gameDisplay}`)
    return
  }

  if (fs.existsSync(videoPath)) {
    log(`video exists, deleting and redownloading: ${gameDisplay}`)
    fs.rmSync(videoPath)
  }

  log(`download all-22 stream: ${gameDisplay}`)
  await downloadVideo(streamUrl, videoPath, options.ytDlpExecutable)
  fs.writeFileSync(jsonPath, JSON.stringify(gameSave, null, 2))
  log(`downloaded complete: ${gameDisplay}`)
}

export async function markGameAsUnavailable(
  page: Page,
  game: NflGame,
  options: NflMainOptions,
): Promise<void> {
  const gameDisplay = `${game.week} ${game.awayTeam} @ ${game.homeTeam}`
  log(`mark game as unavailable: ${gameDisplay}`)
  const gameSave = createNflGameSave(game)
  const jsonFilename = gameSave.videoFilename.replace('.mp4', '.json')
  const jsonPath = path.join(options.pathToSavedGames, jsonFilename)
  gameSave.videoFilename = 'UNAVAILABLE'
  fs.writeFileSync(jsonPath, JSON.stringify(gameSave, null, 2))
}
