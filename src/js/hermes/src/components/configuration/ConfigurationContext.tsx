import {createContext} from 'react'
import {Configuration} from '@/lib/types'

const defaultConfiguration: Configuration = {
  browser: {
    headless: false,
    executablePath: '/usr/bin/google-chrome',
    userDataDir: '/tmp/chrome-data',
  },
  accounts: [],
}

export const ConfigurationContext = createContext<Configuration>(defaultConfiguration)
