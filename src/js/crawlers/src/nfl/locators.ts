import {Locator, Page} from 'playwright'
import {
  NflGame,
  VideoType,
  Week,
  createNflGameSave,
  getUrlValueFromWeek,
  getWeekFromUrlValue,
} from './types'

export function locateSignIn(page: Page): Locator {
  return page.getByText('Sign In')
}

export function locateMyProfile(page: Page): Locator {
  return page.locator('*[data-is-logged-in]')
}

export function locateAcceptCookies(page: Page): Locator {
  return page.getByText('Accept Cookies')
}

export function locateYearSelector(page: Page): Locator {
  return page.getByRole('combobox').filter({hasText: '2023'}).filter({hasText: '2022'})
}

export function locateWeekSelector(page: Page): Locator {
  return page.getByRole('combobox').filter({hasText: 'Week 1'}).filter({hasText: 'Week 2'})
}

export function locateReplayHeading(page: Page, week: string): Locator {
  return page.getByRole('heading').filter({hasText: `Replay ${week}`})
}

export function locateGameCard(page: Page): Locator {
  return page.getByTestId('replay-card')
}

export function locateVideoPlayer(page: Page): Locator {
  return page.getByLabel('Video Player')
}

export function locateVideoSelector(page: Page, type: VideoType): Locator {
  return page.locator(`div:has(> div > div:text("${type}"))`)
}

export async function isVideoSelectorEnabled(videoSelector: Locator): Promise<boolean> {
  return (await videoSelector.locator('text="Currently Playing"').count()) === 1
}

export function getReplaysUrl(): string {
  return 'https://www.nfl.com/plus/replays/'
}

export function getGameUrl(game: NflGame): string {
  const awayTeam = game.awayTeam.toLowerCase().replace(/ /g, '-')
  const homeTeam = game.homeTeam.toLowerCase().replace(/ /g, '-')
  const teams = `${awayTeam}-at-${homeTeam}`
  const time = `${game.season}-${getUrlValueFromWeek(game.week)}`
  return `https://www.nfl.com/plus/games/${teams}-${time}`
}

export function getWeekUrl(season: string, week: Week): string {
  const weekAdjusted = getUrlValueFromWeek(week).replace('-', '')
  return `https://www.nfl.com/plus/replays/${season}/${weekAdjusted}`
}

export function getWeekFromUrl(url: string): {season: string; week: Week} {
  const [_, season, week] = url.match(/replays\/(\d+)\/(\w+)/) || []
  return {season, week: getWeekFromUrlValue(week)}
}
