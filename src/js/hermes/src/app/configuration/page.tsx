'use client'

import {useState} from 'react'
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
import {PlusCircle, Settings} from 'lucide-react'
import Link from 'next/link'
import {
  Configuration,
  ConnectedAccount,
  ConnectedAccountType,
  IngestionSourceType,
} from '@/lib/types'
import {AccountConfigCard} from '@/components/configuration/AccountConfigCard'
import {BrandIcon} from '@/components/BrandIcon'

// Mock initial configuration for demonstration
const initialConfig: Configuration = {
  browser: {
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    userDataDir: '/tmp/chrome-data',
  },
  accounts: [
    {
      id: '1',
      type: ConnectedAccountType.GOOGLE,
      username: 'user@gmail.com',
      password: '********',
      ingestions: [
        {id: 'g1', sourceType: IngestionSourceType.GMAIL},
        {id: 'g2', sourceType: IngestionSourceType.GOOGLE_DRIVE},
      ],
    },
  ],
}

export default function ConfigurationPage() {
  const [config, setConfig] = useState<Configuration>(initialConfig)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    config.accounts.length > 0 ? config.accounts[0].id : null,
  )

  const selectedAccount = config.accounts.find((account) => account.id === selectedAccountId)

  const handleAddAccount = () => {
    const newAccount: ConnectedAccount = {
      id: Date.now().toString(),
      type: ConnectedAccountType.GOOGLE,
      username: '',
      password: '',
      ingestions: [],
    }

    const updatedAccounts = [...config.accounts, newAccount]
    setConfig({...config, accounts: updatedAccounts})
    setSelectedAccountId(newAccount.id)
  }

  const handleAccountChange = (field: keyof ConnectedAccount, value: string | boolean) => {
    if (!selectedAccountId) return

    const updatedAccounts = config.accounts.map((account) => {
      if (account.id === selectedAccountId) {
        return {...account, [field]: value}
      }
      return account
    })

    setConfig({...config, accounts: updatedAccounts})
  }

  const handleBrowserConfigChange = (
    field: keyof Configuration['browser'],
    value: string | boolean,
  ) => {
    setConfig({
      ...config,
      browser: {
        ...config.browser,
        [field]: value,
      },
    })
  }

  const handleToggleIngestion = (sourceType: IngestionSourceType) => {
    if (!selectedAccountId) return

    const updatedAccounts = config.accounts.map((account) => {
      if (account.id === selectedAccountId) {
        const existingIngestion = account.ingestions.find((i) => i.sourceType === sourceType)

        let updatedIngestions = [...account.ingestions]
        if (existingIngestion) {
          // Remove the ingestion if it exists
          updatedIngestions = updatedIngestions.filter((i) => i.sourceType !== sourceType)
        } else {
          // Add the ingestion if it doesn't exist
          updatedIngestions.push({
            id: Date.now().toString(),
            sourceType,
          })
        }

        return {...account, ingestions: updatedIngestions}
      }
      return account
    })

    setConfig({...config, accounts: updatedAccounts})
  }

  const handleSaveConfiguration = () => {
    // Here you would typically save the configuration to your backend
    console.log('Saving configuration:', config)
    // For demo purposes, we'll just show an alert
    alert('Configuration saved successfully!')
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Configuration</h1>
        <Button asChild>
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={selectedAccountId === null ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setSelectedAccountId(null)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Global Settings
              </Button>
              {config.accounts.map((account) => (
                <Button
                  key={account.id}
                  className="w-full justify-start"
                  variant={selectedAccountId === account.id ? 'default' : 'outline'}
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <BrandIcon brand={account.type} className="mr-2 h-4 w-4" />
                  <p className="text-sm">{account.username || 'Not configured'}</p>
                </Button>
              ))}
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline" onClick={handleAddAccount}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          {selectedAccount ? (
            <AccountConfigCard
              selectedAccount={selectedAccount}
              handleAccountChange={handleAccountChange}
              handleToggleIngestion={handleToggleIngestion}
              handleSaveConfiguration={handleSaveConfiguration}
            />
          ) : (
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
                  <Switch
                    id="headless"
                    checked={config.browser.headless}
                    onCheckedChange={(checked: boolean) =>
                      handleBrowserConfigChange('headless', checked)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="executablePath">Browser Executable Path</Label>
                  <Input
                    id="executablePath"
                    value={config.browser.executablePath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleBrowserConfigChange('executablePath', e.target.value)
                    }
                    placeholder="/path/to/browser"
                  />
                  <p className="text-muted-foreground mt-1 text-sm">
                    Path to the browser executable on your system
                  </p>
                </div>

                <div>
                  <Label htmlFor="userDataDir">User Data Directory</Label>
                  <Input
                    id="userDataDir"
                    value={config.browser.userDataDir}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleBrowserConfigChange('userDataDir', e.target.value)
                    }
                    placeholder="/path/to/user/data"
                  />
                  <p className="text-muted-foreground mt-1 text-sm">
                    Directory to store browser profile data
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveConfiguration}>Save Changes</Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
