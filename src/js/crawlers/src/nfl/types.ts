export interface NflMainOptions {
  username: string
  password: string

  userDataDir: string
  ytDlpExecutable: string
  pathToSavedGames: string

  targetResolution: '1080p' | '720p'
  targetVideoType: VideoType
}

export interface NflCrawlState {
  savedGames: NflGameSave[]

  season: NflGame['season']
  week: Week
}

export interface NflGame {
  season: '2023' | '2022' | '2021' | string
  week: Week

  awayTeam: string
  homeTeam: string
  date: string
}

export interface NflGameSave extends NflGame {
  videoFilename: string
  resolution: '720p' | '1080p'

  downloadedAt: string // ISO date string
}

export enum VideoType {
  Any = 'any',
  FullGame = 'Full Game Replay',
  CondensedGame = 'Condensed Game Replay',
  All22 = 'All-22',
}

export enum Week {
  Week1 = 'Week 1',
  Week2 = 'Week 2',
  Week3 = 'Week 3',
  Week4 = 'Week 4',
  Week5 = 'Week 5',
  Week6 = 'Week 6',
  Week7 = 'Week 7',
  Week8 = 'Week 8',
  Week9 = 'Week 9',
  Week10 = 'Week 10',
  Week11 = 'Week 11',
  Week12 = 'Week 12',
  Week13 = 'Week 13',
  Week14 = 'Week 14',
  Week15 = 'Week 15',
  Week16 = 'Week 16',
  Week17 = 'Week 17',
  WildCard = 'Wild Card Round',
  Divisional = 'Divisional Round',
  Conference = 'Conference Championships',
  SuperBowl = 'Super Bowl',
}

export const SEASONS = ['2023', '2022', '2021', '2020', '2019']
export const WEEKS = Object.values(Week)

export function getUrlValueFromWeek(week: Week): string {
  if (week === Week.WildCard) return 'post-1'
  if (week === Week.Divisional) return 'post-2'
  if (week === Week.Conference) return 'post-3'
  if (week === Week.SuperBowl) return 'post-4'
  return week.toLowerCase().replace('week', 'reg').replace(' ', '-')
}

export function getWeekFromUrlValue(urlPart: string): Week {
  let week = WEEKS.find(week => urlPart === getUrlValueFromWeek(week))
  if (week) return week
  week = WEEKS.find(week => urlPart === getUrlValueFromWeek(week).replace('-', ''))
  if (week) return week

  throw new Error(`unknown week value: ${urlPart}`)
}

export function createNflGameSave(
  game: Omit<NflGame, 'videoFilename' | 'resolution'>,
): NflGameSave {
  return {
    ...game,
    videoFilename: getFilenameForGame(game),
    resolution: '1080p',
    downloadedAt: new Date().toISOString(),
  }
}

export function getFilenameForGame(game: NflGame) {
  return `${game.season}-${game.week.replace(/\s+/g, '')}-${game.awayTeam}-at-${game.homeTeam}.mp4`
}

export class AuthError extends Error {}
export class LoadingError extends Error {}
