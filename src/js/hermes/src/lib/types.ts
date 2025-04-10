import {capitalize} from './words'

export interface Configuration {
  browser: BrowserConfiguration
  accounts: ConnectedAccount[]
}

export enum ConnectedAccountType {
  GOOGLE = 'google',
  TARGET = 'target',
  AMAZON = 'amazon',
  COSTCO = 'costco',
}

export interface ConnectedAccount {
  id: string
  type: ConnectedAccountType
  username: string
  password: string
  decryptedPassword?: string
  ingestions: Ingestion[]
}

export interface Ingestion {
  id: string
  sourceType: IngestionSourceType
}

export enum IngestionSourceType {
  GMAIL = 'gmail',
  GOOGLE_DRIVE = 'google_drive',
  GOOGLE_MAPS = 'google_maps',
  GOOGLE_CALENDAR = 'google_calendar',
  GOOGLE_PHOTOS = 'google_photos',
  TRANSACTIONS = 'transactions',
}

export interface BrowserConfiguration {
  headless: boolean
  executablePath: string
  userDataDir: string
}

export function getLabelForIngestionSourceType(sourceType: IngestionSourceType) {
  switch (sourceType) {
    case IngestionSourceType.GMAIL:
      return 'GMail'
    default: {
      return capitalize(sourceType)
    }
  }
}
