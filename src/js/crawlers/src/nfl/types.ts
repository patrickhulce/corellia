export interface NflMainOptions {
  username: string
  password: string

  userDataDir: string
  ytDlpExecutable: string
  pathToSavedGames: string
}

export interface NflCrawlState {
  savedGames: NflSavedGame[]

  currentSeason: string | undefined
  currentWeek: Week | undefined
}

export interface NflSavedGame {
  season: string // Example: '2023'
  week: Week

  awayTeam: string
  homeTeam: string
  date: string

  videoFilename: string
  resolution: '720p' | '1080p'
}

export enum VideoType {
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
