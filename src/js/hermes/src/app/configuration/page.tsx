'use client'

import {useContext, useLayoutEffect} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Switch} from '@/components/ui/switch'
import {Configuration} from '@/lib/types'
import {ConfigurationContext} from '@/components/configuration/ConfigurationContext'
import {saveConfiguration} from './actions'

async function handleSaveConfiguration(formData: FormData, oldConfig: Configuration) {
  const config: Configuration = {
    ...oldConfig,
    browser: {
      headless: formData.get('headless') === 'true',
      executablePath: formData.get('executablePath')?.toString() ?? '',
      userDataDir: formData.get('userDataDir')?.toString() ?? '',
    },
  }

  await saveConfiguration(config)
}

export default function GlobalSettingsPage() {
  const config = useContext(ConfigurationContext)

  useLayoutEffect(() => {
    if (!config) return
    const headless = document.getElementById('headless') as HTMLInputElement
    const executablePath = document.getElementById('executablePath') as HTMLInputElement
    const userDataDir = document.getElementById('userDataDir') as HTMLInputElement

    headless.checked = config.browser.headless
    executablePath.value = config.browser.executablePath
    userDataDir.value = config.browser.userDataDir
  }, [config])

  return (
    <form action={(formData) => handleSaveConfiguration(formData, config)}>
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Configure browser automation settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="headless" className="flex-1">
              Headless Mode
              <p className="text-muted-foreground text-sm">Run browser without visible UI</p>
            </Label>
            <Switch id="headless" />
          </div>

          <div>
            <Label htmlFor="executablePath">Browser Executable Path</Label>
            <Input id="executablePath" placeholder="/path/to/browser" />
            <p className="text-muted-foreground mt-1 text-sm">
              Path to the browser executable on your system
            </p>
          </div>

          <div>
            <Label htmlFor="userDataDir">User Data Directory</Label>
            <Input id="userDataDir" placeholder="/path/to/user/data" />
            <p className="text-muted-foreground mt-1 text-sm">
              Directory to store browser profile data
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Save Changes</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
