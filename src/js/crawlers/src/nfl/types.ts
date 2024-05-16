export interface NflMainOptions {
  username: string
  password: string

  userDataDir: string
  ytDlpExecutable: string
  pathToSavedGames: string
}

export interface NflCrawlState {
  savedGames: NflSavedGame[]
}

export interface NflSavedGame {
  season: string // Example: '2023'
  week: string // Example: 'Week 1'

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
