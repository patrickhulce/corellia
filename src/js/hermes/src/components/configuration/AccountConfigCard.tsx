'use client'

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
import {
  ConnectedAccount,
  ConnectedAccountType,
  getLabelForIngestionSourceType,
  IngestionSourceType,
} from '@/lib/types'
import {capitalize} from '@/lib/words'

interface AccountConfigCardProps {
  selectedAccount: ConnectedAccount
  handleAccountChange: (field: keyof ConnectedAccount, value: string | boolean) => void
  handleToggleIngestion: (sourceType: IngestionSourceType) => void
  handleSaveConfiguration: () => void
}

export function AccountConfigCard({
  selectedAccount,
  handleAccountChange,
  handleToggleIngestion,
  handleSaveConfiguration,
}: AccountConfigCardProps) {
  const isIngestionEnabled = (sourceType: IngestionSourceType) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Configuration</CardTitle>
        <CardDescription>Configure your {capitalize(selectedAccount.type)} account</CardDescription>
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
                  {capitalize(type)}
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
                  {getLabelForIngestionSourceType(sourceType)}
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
  )
}
