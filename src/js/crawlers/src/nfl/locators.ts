import {Locator, Page} from 'playwright'
import {NflSavedGame, VideoType} from './types'

export async function yearSelector(page: Page): Promise<Locator> {
  return page.getByRole('combobox').filter({hasText: '2023'}).filter({hasText: '2022'})
}

export async function weekSelector(page: Page): Promise<Locator> {
  return page.getByRole('combobox').filter({hasText: 'Week 1'}).filter({hasText: 'Week 2'})
}

export async function replayHeading(page: Page, week: string): Promise<Locator> {
  return page.getByRole('heading').filter({hasText: `Replay ${week}`})
}

export async function gameCard(page: Page): Promise<Locator> {
  return page.getByTestId('replay-card')
}

export async function videoPlayer(page: Page): Promise<Locator> {
  return page.getByLabel('Video Player')
}

export async function videoSelector(page: Page, type: VideoType): Promise<Locator> {
  return page.locator(`div:has(> div > div:text("${type}"))`)
}

export async function isVideoSelectorEnabled(videoSelector: Locator): Promise<boolean> {
  return (await videoSelector.locator('text="Currently Playing"').count()) === 1
}

export async function extractVideoDuration(videoPlayer: Locator): Promise<string> {
  const text = await videoPlayer.textContent()
  if (!text || !text.includes(' / ')) throw new Error(`Could not extract duration from: ${text}`)
  const duration = text.match(/\/ (\d+:\d+:\d+)/)?.[1]
  if (!duration) throw new Error(`Could not extract duration from: ${text}`)
  return duration
}

export async function extractAvailableVideos(
  page: Page,
): Promise<Array<{type: VideoType; selected: boolean; locator: Locator}>> {
  return Promise.all(
    Object.values(VideoType).map(async type => {
      const $selector = await videoSelector(page, type)
      return {type, selected: await isVideoSelectorEnabled($selector), locator: $selector}
    }),
  )
}

export async function createGameUrl(game: NflSavedGame): Promise<string> {
  return `https://www.nfl.com/plus/games/${game.awayTeam.toLowerCase()}-at-${game.homeTeam.toLowerCase()}-${
    game.season
  }-${game.week.toLowerCase().replace('week', 'reg').replace(' ', '-')}`
}

export async function extractGameInfo(
  gameCard: Locator,
  context: Pick<NflSavedGame, 'season' | 'week'>,
): Promise<NflSavedGame> {
  const teams = await gameCard.getByTestId('replay-card-team-section')
  const awayTeam = ((await teams.first().textContent()) || '').replace(/\d+/, '').trim()
  const homeTeam = ((await teams.last().textContent()) || '').replace(/\d+/, '').trim()

  const date = ((await gameCard.getByTestId('replay-card-footer').textContent()) || '')
    .split('·')[1]
    .trim()
    .replace(/(\w{3} \d+).*/g, '$1')

  return {
    season: context.season,
    week: context.week,
    awayTeam,
    homeTeam,
    date,

    videoFilename: '',
    resolution: '1080p',
  }
}
