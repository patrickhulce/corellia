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
  getAvailableIngestionTypes,
  getLabelForIngestionSourceType,
  IngestionSourceType,
} from '@/lib/types'
import {capitalize} from '@/lib/words'
import {BrandIcon} from '@/components/BrandIcon'

interface AccountConfigCardProps {
  selectedAccount: ConnectedAccount
  handleAccountChange: (field: keyof ConnectedAccount, value: string | boolean) => void
  handleToggleIngestion: (sourceType: IngestionSourceType) => void
  handleSaveConfiguration: () => void
}

export const NEW_ACCOUNT_ID = '__new-account__'

export function AccountConfigCard({
  selectedAccount,
  handleAccountChange,
  handleToggleIngestion,
  handleSaveConfiguration,
}: AccountConfigCardProps) {
  const isIngestionEnabled = (sourceType: IngestionSourceType) => {
    return selectedAccount.ingestions.some((i) => i.sourceType === sourceType)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Configuration</CardTitle>
        <CardDescription>Configure your {capitalize(selectedAccount.type)} account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {selectedAccount.id === NEW_ACCOUNT_ID ? (
            <div>
              <Label className="mb-2 block">Account Type</Label>
              <div className="flex flex-wrap gap-3">
                {Object.values(ConnectedAccountType).map((type) => (
                  <Button
                    key={type}
                    variant={selectedAccount.type === type ? 'default' : 'outline'}
                    className="flex h-20 w-24 flex-col items-center justify-center p-2"
                    onClick={() => handleAccountChange('type', type)}
                  >
                    <BrandIcon brand={type} className="mb-1 h-10 w-10" />
                    <span className="text-xs">{capitalize(type)}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

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
