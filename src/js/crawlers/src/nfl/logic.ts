import * as _ from 'lodash'
import {NflGame, NflGameSave, NflMainOptions, SEASONS, WEEKS, Week} from './types'

export function computeLastSavedWeek(savedGames: NflGameSave[]): {season: string; week: Week} {
  const savedGamesBySeason = savedGames.reduce((acc, game) => {
    if (!acc[game.season]) {
      acc[game.season] = []
    }
    acc[game.season].push(game)
    return acc
  }, {} as Record<string, NflGame[]>)

  const seasons = Object.keys(savedGamesBySeason)
  const seasonWithFewestGames = _.minBy(seasons, s => savedGamesBySeason[s].length) || SEASONS[0]
  const gamesOfSeason = savedGamesBySeason[seasonWithFewestGames] || []
  const latestWeek = _.maxBy(gamesOfSeason, g => WEEKS.indexOf(g.week))?.week || Week.Week1

  return {season: seasonWithFewestGames, week: latestWeek}
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
