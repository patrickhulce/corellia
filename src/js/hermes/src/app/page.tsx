import {Button} from '@/components/ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@/components/ui/card'
import Link from 'next/link'
import {BarChartIcon, DownloadCloudIcon, UserCogIcon} from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold ">Welcome to Hermes</h1>
        <p className="text-primary text-xl">Choose an option to get started</p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        {/* Configure Card */}
        <Card className="backdrop-blur-sm transition-all">
          <CardHeader className="text-center">
            <div className="mb-6 flex justify-center">
              <UserCogIcon size={96} strokeWidth={1.5} />
            </div>
            <CardTitle className="text-2xl">Configure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-center">Connect your accounts to access your data</p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/configuration">Connect Accounts</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Ingest Card */}
        <Card className="backdrop-blur-sm transition-all">
          <CardHeader className="text-center">
            <div className="mb-6 flex justify-center">
              <DownloadCloudIcon size={96} strokeWidth={1.5} />
            </div>
            <CardTitle className="text-2xl">Ingest</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-center">
              Download your data from your connected accounts
            </p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
              <Link href="/ingest">Download Data</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* View Card */}
        <Card className="backdrop-blur-sm transition-all">
          <CardHeader className="text-center">
            <div className="mb-6 flex justify-center">
              <BarChartIcon size={96} strokeWidth={1.5} />
            </div>
            <CardTitle className="text-2xl">View</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-primary text-center">Explore and visualize your ingested data</p>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button className="w-full bg-purple-600 hover:bg-purple-700" asChild>
              <Link href="/view">Explore</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <footer className="text-primary mt-16 text-sm">© 2025 Hermes. All rights reserved.</footer>
    </main>
  )
}
