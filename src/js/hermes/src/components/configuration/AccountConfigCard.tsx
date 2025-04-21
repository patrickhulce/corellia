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
import {useState} from 'react'

interface AccountConfigCardProps {
  initialAccount: ConnectedAccount
  onSave: (account: ConnectedAccount) => void
}

export const NEW_ACCOUNT_ID = 'new'

export function AccountConfigCard({initialAccount, onSave}: AccountConfigCardProps) {
  const [account, setAccount] = useState<ConnectedAccount>(initialAccount)
  const handleAccountChange = (field: keyof ConnectedAccount, value: string | boolean) => {
    setAccount({...account, [field]: value})
  }

  const handleToggleIngestion = (sourceType: IngestionSourceType) => {
    setAccount({
      ...account,
      ingestions: account.ingestions.some((i) => i.sourceType === sourceType)
        ? account.ingestions.filter((i) => i.sourceType !== sourceType)
        : [...account.ingestions, {sourceType, id: crypto.randomUUID()}],
    })
  }

  const isIngestionEnabled = (sourceType: IngestionSourceType) => {
    return account.ingestions.some((i) => i.sourceType === sourceType)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Configuration</CardTitle>
        <CardDescription>Configure your {capitalize(account.type)} account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {account.id === NEW_ACCOUNT_ID ? (
            <div>
              <Label className="mb-2 block">Account Type</Label>
              <div className="flex flex-wrap gap-3">
                {Object.values(ConnectedAccountType).map((type) => (
                  <Button
                    key={type}
                    variant={account.type === type ? 'default' : 'outline'}
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
              value={account.username}
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
              value={account.password}
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
            {getAvailableIngestionTypes(account.type).map((sourceType) => (
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
        <Button onClick={() => onSave(account)}>Save Changes</Button>
      </CardFooter>
    </Card>
  )
}
