'use server'

import {Configuration} from '@/lib/types'
import {setConfiguration} from '@/lib/server/configuration'

export async function saveConfiguration(configuration: Configuration) {
  setConfiguration(configuration)
}
