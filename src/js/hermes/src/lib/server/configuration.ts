import {promises as fs} from 'fs'
import {BrowserConfiguration, Configuration} from '../types'
import path from 'path'
import debug from 'debug'

const log = debug('hermes:configuration')

const CHROME_EXECUTABLE_PATHS = [
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable',
]

function _getHermesDirectory(): string {
  if (process.env.HERMES_DIRECTORY) {
    return path.resolve(process.cwd(), process.env.HERMES_DIRECTORY)
  }

  // on MacOS, use ~/Library/Application Support/Hermes
  if (process.platform === 'darwin') {
    return `${process.env.HOME}/Library/Application Support/Hermes`
  }

  // on Linux, use ~/.config/hermes
  if (process.platform === 'linux') {
    return `${process.env.HOME}/.config/hermes`
  }

  // on Windows, use %APPDATA%/Hermes
  if (process.platform === 'win32') {
    return `${process.env.APPDATA}/Hermes`
  }

  return path.resolve(process.cwd(), '.data')
}

async function _findChromeExecutablePath(): Promise<string> {
  for (const path of CHROME_EXECUTABLE_PATHS) {
    if (await fs.stat(path).catch(() => false)) {
      return path
    }
  }

  throw new Error('Chrome executable not found')
}

async function _getDefaultBrowserConfiguration(): Promise<BrowserConfiguration> {
  return {
    headless: false,
    executablePath: await _findChromeExecutablePath(),
    userDataDir: path.resolve(_getHermesDirectory(), 'chrome'),
  }
}

async function _getDefaultConfiguration(): Promise<Configuration> {
  return {
    browser: await _getDefaultBrowserConfiguration(),
    accounts: [],
  }
}
function _getConfigurationPath(): string {
  if (process.env.HERMES_FILE_PATH) {
    return process.env.HERMES_FILE_PATH
  }

  return path.resolve(_getHermesDirectory(), 'hermes.json')
}

async function _readConfiguration(): Promise<Configuration> {
  const configuration = await fs.readFile(_getConfigurationPath(), 'utf8')
  return JSON.parse(configuration)
}

async function _writeConfiguration(configuration: Configuration): Promise<void> {
  await fs.writeFile(_getConfigurationPath(), JSON.stringify(configuration, null, 2))
}
async function _init(): Promise<Configuration> {
  const hermesDirectory = _getHermesDirectory()
  log('using hermes directory', hermesDirectory)
  await fs.mkdir(hermesDirectory, {recursive: true})

  const configurationPath = _getConfigurationPath()
  log('using configuration path', configurationPath)
  if (await fs.stat(configurationPath).catch(() => false)) {
    log('configuration file exists, reading configuration')
    return await _readConfiguration()
  }

  log('configuration file does not exist, creating default configuration')
  const configuration = await _getDefaultConfiguration()
  await _writeConfiguration(configuration)
  return configuration
}

let _configurationPromise: Promise<Configuration> | null = null

export async function getConfiguration(): Promise<Configuration> {
  if (_configurationPromise) {
    return _configurationPromise
  }

  _configurationPromise = _init()
  return _configurationPromise
}

export async function setConfiguration(configuration: Configuration): Promise<void> {
  _configurationPromise = Promise.resolve(configuration)
  await _writeConfiguration(configuration)
}
