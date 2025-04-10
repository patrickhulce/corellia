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
import {PlusCircle, Trash2, Settings, User} from 'lucide-react'
import Link from 'next/link'
import {
  Configuration,
  ConnectedAccount,
  ConnectedAccountType,
  IngestionSourceType,
} from '@/lib/types'

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
  const [activeTab, setActiveTab] = useState<'account' | 'browser'>('account')

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
    setActiveTab('account')
  }

  const handleDeleteAccount = (id: string) => {
    const updatedAccounts = config.accounts.filter((account) => account.id !== id)
    setConfig({...config, accounts: updatedAccounts})

    if (selectedAccountId === id) {
      setSelectedAccountId(updatedAccounts.length > 0 ? updatedAccounts[0].id : null)
    }
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

  const getAccountTypeLabel = (type: ConnectedAccountType) => {
    switch (type) {
      case ConnectedAccountType.GOOGLE:
        return 'Google'
      case ConnectedAccountType.TARGET:
        return 'Target'
      case ConnectedAccountType.AMAZON:
        return 'Amazon'
      case ConnectedAccountType.COSTCO:
        return 'Costco'
      default:
        return 'Unknown'
    }
  }

  const getIngestionLabel = (sourceType: IngestionSourceType) => {
    switch (sourceType) {
      case IngestionSourceType.GMAIL:
        return 'Gmail'
      case IngestionSourceType.GOOGLE_DRIVE:
        return 'Google Drive'
      case IngestionSourceType.GOOGLE_MAPS:
        return 'Google Maps'
      case IngestionSourceType.GOOGLE_CALENDAR:
        return 'Google Calendar'
      case IngestionSourceType.GOOGLE_PHOTOS:
        return 'Google Photos'
      case IngestionSourceType.TRANSACTIONS:
        return 'Transactions'
      default:
        return 'Unknown'
    }
  }

  const isIngestionEnabled = (sourceType: IngestionSourceType) => {
    if (!selectedAccount) return false
    return selectedAccount.ingestions.some((i) => i.sourceType === sourceType)
  }

  const getAvailableIngestionTypes = (accountType: ConnectedAccountType) => {
    switch (accountType) {
      case ConnectedAccountType.GOOGLE:
        return [
          IngestionSourceType.GMAIL,
          IngestionSourceType.GOOGLE_DRIVE,
          IngestionSourceType.GOOGLE_MAPS,
          IngestionSourceType.GOOGLE_CALENDAR,
          IngestionSourceType.GOOGLE_PHOTOS,
        ]
      case ConnectedAccountType.TARGET:
      case ConnectedAccountType.AMAZON:
      case ConnectedAccountType.COSTCO:
        return [IngestionSourceType.TRANSACTIONS]
      default:
        return []
    }
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
                variant={activeTab === 'account' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setActiveTab('account')}
              >
                <User className="mr-2 h-4 w-4" />
                Accounts
              </Button>
              <Button
                variant={activeTab === 'browser' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setActiveTab('browser')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Browser Settings
              </Button>
            </CardContent>
          </Card>

          {activeTab === 'account' && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Select an account to configure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {config.accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md p-2 ${
                      selectedAccountId === account.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary'
                    }`}
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <div>
                      <p className="font-medium">{getAccountTypeLabel(account.type)}</p>
                      <p className="text-sm">{account.username || 'Not configured'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteAccount(account.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" onClick={handleAddAccount}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          {activeTab === 'account' ? (
            selectedAccount ? (
              <Card>
                <CardHeader>
                  <CardTitle>Account Configuration</CardTitle>
                  <CardDescription>
                    Configure your {getAccountTypeLabel(selectedAccount.type)} account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="accountType">Account Type</Label>
                      <select
                        id="accountType"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedAccount.type}
                        onChange={(e) => handleAccountChange('type', e.target.value)}
                      >
                        {Object.values(ConnectedAccountType).map((type) => (
                          <option key={type} value={type}>
                            {getAccountTypeLabel(type as ConnectedAccountType)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={selectedAccount.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleAccountChange('username', e.target.value)
                        }
                        placeholder="Enter your username or email"
                      />
                    </div>

                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={selectedAccount.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleAccountChange('password', e.target.value)
                        }
                        placeholder="Enter your password"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Data Sources</h3>
                    <p className="text-muted-foreground text-sm">
                      Select which data sources to ingest from this account
                    </p>

                    <div className="space-y-2">
                      {getAvailableIngestionTypes(selectedAccount.type).map((sourceType) => (
                        <div key={sourceType} className="flex items-center justify-between">
                          <Label htmlFor={`ingestion-${sourceType}`} className="flex-1">
                            {getIngestionLabel(sourceType)}
                          </Label>
                          <Switch
                            id={`ingestion-${sourceType}`}
                            checked={isIngestionEnabled(sourceType)}
                            onCheckedChange={() => handleToggleIngestion(sourceType)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveConfiguration}>Save Changes</Button>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground mb-4">No account selected</p>
                  <Button onClick={handleAddAccount}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Browser Settings</CardTitle>
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
