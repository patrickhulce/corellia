import {Locator, Page} from 'playwright'
import {NflSavedGame} from './types'

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
