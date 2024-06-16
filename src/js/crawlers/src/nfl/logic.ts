import * as _ from 'lodash'
import {NflGame, NflGameSave, NflMainOptions, SEASONS, WEEKS, Week} from './types'
import {BYE_WEEKS} from './bye-weeks'
import createLogger from 'debug'

const log = createLogger('nfl:logic')

export function computeLastSavedWeek(savedGames: NflGameSave[]): {season: string; week: Week} {
  const savedGamesBySeasonByWeek = new Map<string, Map<Week, NflGameSave[]>>()
  for (const game of savedGames) {
    const bySeason = savedGamesBySeasonByWeek.get(game.season) || new Map<Week, NflGameSave[]>()
    const byWeek = bySeason.get(game.week) || []
    byWeek.push(game)
    bySeason.set(game.week, byWeek)
    savedGamesBySeasonByWeek.set(game.season, bySeason)
  }

  // First, compute the number of missing games for each week using bye week data.
  const missingGameCounts = new Array<[string, Week, number]>()
  for (const season of SEASONS) {
    for (const week of WEEKS) {
      const byeWeekEntry = BYE_WEEKS.find(b => b.season === season && b.week === week)
      const byeWeeks = byeWeekEntry ? byeWeekEntry.byes : 0

      const expected = 16 - byeWeeks / 2
      const actual = (savedGamesBySeasonByWeek.get(season)?.get(week) || []).length

      missingGameCounts.push([season, week, expected - actual])
    }
  }

  // Next, find the weeks with missing games.
  const missingWeeks = missingGameCounts.filter(([_, __, missingGames]) => missingGames > 0)
  const latestSeason = _.maxBy(missingWeeks, ([season]) => parseInt(season, 10))?.[0]
  const missingWeeksInLatestSeason = missingWeeks.filter(([season]) => season === latestSeason)

  // Next, use the earliest week in the latest season.
  const [season, week, missing] =
    _.minBy(missingWeeksInLatestSeason, ([__, week]) => WEEKS.indexOf(week)) || []

  if (!season || !week) {
    return {season: SEASONS[0], week: Week.Week1}
  }

  log(`resume ${season} ${week} (${missing} missing games)`)
  return {season, week}
}

export function computeNextGameToDownload(
  savedGames: NflGameSave[],
  availableGames: NflGame[],
): NflGame | undefined {
  const savedGameKeys = new Set(savedGames.map(getGameKey))
  return availableGames.find(game => !savedGameKeys.has(getGameKey(game)))
}

export function computeNextWeekToDownload(currentWeek: {season: string; week: Week}): {
  season: string
  week: Week
} {
  const currentWeekIndex = WEEKS.indexOf(currentWeek.week)
  const nextWeekIndex = currentWeekIndex + 1
  if (nextWeekIndex < WEEKS.length) {
    return {season: currentWeek.season, week: WEEKS[nextWeekIndex]}
  }

  const currentSeasonIndex = SEASONS.indexOf(currentWeek.season)
  const nextSeasonIndex = currentSeasonIndex + 1
  if (nextSeasonIndex < SEASONS.length) {
    return {season: SEASONS[nextSeasonIndex], week: Week.Week1}
  }

  return {season: SEASONS[0], week: Week.Week1}
}

export function computeVideoStreamToUse(
  entries: Array<{url: string; resolution: string}>,
  options: NflMainOptions,
): string | undefined {
  const targetResolution = options.targetResolution === '1080p' ? '1920x1080' : '1280x720'
  const entry = entries.find(e => e.resolution === targetResolution)
  return entry?.url
}

export function hasDownloadedEveryGame(savedGames: NflGameSave[]): boolean {
  // FIXME: This isn't actually true and we rely on `break` in the code, but it gets the intent across.
  return savedGames.length === SEASONS.length * WEEKS.length * 16
}

export function getGameKey(game: NflGame): string {
  return `${game.season}-${game.week}-${game.awayTeam}-at-${game.homeTeam}`
}
