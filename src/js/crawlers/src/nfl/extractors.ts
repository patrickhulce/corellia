import {Locator, Page} from 'playwright'
import {NflGame, NflMainOptions, VideoType} from './types'
import {
  getWeekFromUrl,
  isVideoSelectorEnabled,
  locateGameCard,
  locateVideoElements,
  locateVideoPlayer,
  locateVideoSelector,
} from './locators'
import {selectVideoType, waitForVideoToPlay, waitForVideoToSelect} from './actions'
import {parseM3U8} from './m3u8'
import createLogger from 'debug'
import waitForExpect from 'wait-for-expect'

const log = createLogger('nfl:extractors')

export async function extractVideoDurationInMinutes(page: Page): Promise<number | undefined> {
  async function extract() {
    const videoElements = locateVideoElements(page)
    for (const videoElementLocator of await videoElements.all()) {
      const videoElement = await videoElementLocator.elementHandle()
      const duration = await page
        .evaluate(el => (el as unknown as HTMLVideoElement).duration, videoElement)
        .catch(() => undefined)
      if (duration) {
        return Math.round(duration / 60)
      }
    }

    return undefined
  }

  let duration = await extract()
  await waitForExpect(async () => {
    duration = await extract()
    if (duration === undefined) {
      throw new Error('Video duration not available')
    }
  }, 15_000)

  return duration
}

export async function extractAvailableGames(
  page: Page,
): Promise<Array<{game: NflGame; locator: Locator}>> {
  const url = page.url()
  const {season, week} = getWeekFromUrl(url)
  const gameCards = await locateGameCard(page)

  log(`extracting games for ${season} ${week}`)
  await gameCards.first().waitFor({state: 'visible'})

  return Promise.all(
    (await gameCards.all()).map(async gameCard => {
      return {
        game: await extractGameInfo(gameCard, {season, week}),
        locator: gameCard,
      }
    }),
  )
}

export async function extractAvailableVideos(
  page: Page,
): Promise<Array<{type: VideoType; selected: boolean; locator: Locator}>> {
  const videos = await Promise.all(
    Object.values(VideoType).map(async type => {
      const $selector = await locateVideoSelector(page, type)
      return {
        type,
        selected: await isVideoSelectorEnabled($selector),
        locator: $selector,
        isPresent: (await $selector.count()) > 0,
      }
    }),
  )

  return videos.filter(v => v.isPresent)
}

export async function extractVideoM3u8(
  page: Page,
  options: NflMainOptions,
  aux: {retries?: number} = {},
): Promise<
  {url: string; content: string; entries: Array<{url: string; resolution: string}>} | undefined
> {
  const videoType = options.targetVideoType
  const {retries = 1} = aux

  try {
    await waitForVideoToSelect(page, VideoType.Any, options)
    await page.waitForTimeout(5_000)
    await waitForVideoToPlay(page, options)

    const [_, m3u8response] = await Promise.all([
      selectVideoType(page, videoType, options),
      page.waitForResponse(response => new URL(response.url()).pathname.endsWith('master.m3u8')),
    ])

    const videoDuration = (await extractVideoDurationInMinutes(page)) ?? 0
    log(`video duration: ${videoDuration} minutes`)
    if (videoType === VideoType.CondensedGame && videoDuration > 90) {
      if (retries === 0) {
        log('condensed game should not be longer than 90 minutes, skipping')
        return undefined
      }

      log('condensed game should not be longer than 90 minutes, retrying selection')
      await selectVideoType(page, VideoType.FullGame, options)
      await waitForVideoToPlay(page, options)
      await page.waitForTimeout(15_000)

      return extractVideoM3u8(page, options, {retries: retries - 1})
    }

    const content = await m3u8response.text()
    const streams = parseM3U8(content)

    return {url: m3u8response.url(), content, entries: streams}
  } catch (err: unknown) {
    log(`failed to extract ${videoType} m3u8: ${(err as Error).stack}`)
    log(`${videoType} is not available for this game`)
    return undefined
  }
}

export async function extractGameInfo(
  gameCard: Locator,
  context: Pick<NflGame, 'season' | 'week'>,
): Promise<NflGame> {
  const teams = await gameCard.getByTestId('replay-card-team-section')
  const awayTeam = ((await teams.first().textContent()) || '').trim().replace(/\d+$/, '')
  const homeTeam = ((await teams.last().textContent()) || '').trim().replace(/\d+$/, '')

  const date = ((await gameCard.getByTestId('replay-card-footer').textContent()) || '')
    .split('·')[1]
    .trim()
    .replace(/(\w{3} \d+).*/g, '$1')

  return {
    ...context,
    awayTeam,
    homeTeam,
    date,
  }
}
