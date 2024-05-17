import {Locator, Page} from 'playwright'
import {
  NflGame,
  NflMainOptions,
  VideoType,
  Week,
  createNflGameSave,
  getUrlValueFromWeek,
} from './types'
import {
  getWeekFromUrl,
  isVideoSelectorEnabled,
  locateGameCard,
  locateVideoSelector,
} from './locators'
import {selectVideoType, waitForVideoToSelect} from './actions'
import {parseM3U8} from './m3u8'
import createLogger from 'debug'

const log = createLogger('nfl:browser-actions')

export async function extractVideoDuration(videoPlayer: Locator): Promise<string> {
  const text = await videoPlayer.textContent()
  if (!text || !text.includes(' / ')) throw new Error(`Could not extract duration from: ${text}`)
  const duration = text.match(/\/ (\d+:\d+:\d+)/)?.[1]
  if (!duration) throw new Error(`Could not extract duration from: ${text}`)
  return duration
}

export async function extractAvailableGames(
  page: Page,
): Promise<Array<{game: NflGame; locator: Locator}>> {
  const url = page.url()
  const {season, week} = getWeekFromUrl(url)
  const gameCards = await locateGameCard(page)

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
  return Promise.all(
    Object.values(VideoType).map(async type => {
      const $selector = await locateVideoSelector(page, type)
      return {type, selected: await isVideoSelectorEnabled($selector), locator: $selector}
    }),
  )
}

export async function extractAll22VideoM3u8(
  page: Page,
  options: NflMainOptions,
): Promise<{url: string; content: string; entries: Array<{url: string; resolution: string}>}> {
  await waitForVideoToSelect(page, VideoType.Any, options)

  const [_, m3u8response] = await Promise.all([
    selectVideoType(page, VideoType.All22, options),
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('master.m3u8')),
  ])

  const content = await m3u8response.text()
  const streams = parseM3U8(content)

  return {url: m3u8response.url(), content, entries: streams}
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
