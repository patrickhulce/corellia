'use client'

import {Button} from '@/components/ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@/components/ui/card'
import {PlusCircle, Settings} from 'lucide-react'
import Link from 'next/link'
import {BrandIcon} from '@/components/BrandIcon'
import {ConfigurationContext} from '@/components/configuration/ConfigurationContext'
import {usePathname} from 'next/navigation'
import useSWR from 'swr'
import {ConnectedAccount} from '@/lib/types'
import {NEW_ACCOUNT_ID} from '@/components/configuration/AccountConfigCard'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function ConfigurationLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname()
  const {data: config, error, isLoading} = useSWR('/api/configuration', fetcher)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  const currentAccountId = /\/configuration\/account\/(\w+)/.exec(pathname)?.[1]

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
              <CardTitle>Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={pathname === '/configuration' ? 'default' : 'outline'}
                className="w-full justify-start"
                asChild
              >
                <Link href="/configuration">
                  <Settings className="mr-2 h-4 w-4" />
                  Global Settings
                </Link>
              </Button>
              {config.accounts.map((account: ConnectedAccount) => (
                <Button
                  key={account.id}
                  className="w-full justify-start"
                  variant={currentAccountId === account.id ? 'default' : 'outline'}
                  asChild
                >
                  <Link href={`/configuration/account/${account.id}`}>
                    <BrandIcon brand={account.type} className="mr-2 h-4 w-4" />
                    <p className="text-sm">{account.username || 'Not configured'}</p>
                  </Link>
                </Button>
              ))}
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/configuration/account/${NEW_ACCOUNT_ID}`}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Account
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          <ConfigurationContext.Provider value={config}>{children}</ConfigurationContext.Provider>
        </div>
      </div>
    </main>
  )
}
