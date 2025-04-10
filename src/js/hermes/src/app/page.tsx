import {Button} from '@/components/ui/button'
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
        <div className="border-primary/20 bg-primary/10 hover:bg-primary/15 flex flex-col items-center rounded-xl border p-8 backdrop-blur-sm transition-all">
          <div className="mb-6 ">
            <UserCogIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold ">Configure</h2>
          <p className="text-primary mb-6 text-center">Connect your accounts to access your data</p>
          <Button className="mt-auto w-full bg-blue-600 hover:bg-blue-700" asChild>
            <Link href="/configuration">Connect Accounts</Link>
          </Button>
        </div>

        {/* Ingest Card */}
        <div className="border-primary/20 bg-primary/10 hover:bg-primary/15 flex flex-col items-center rounded-xl border p-8 backdrop-blur-sm transition-all">
          <div className="mb-6 ">
            <DownloadCloudIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold ">Ingest</h2>
          <p className="text-primary mb-6 text-center">
            Download your data from your connected accounts
          </p>
          <Button className="mt-auto w-full bg-green-600 hover:bg-green-700" asChild>
            <Link href="/ingest">Download Data</Link>
          </Button>
        </div>

        {/* View Card */}
        <div className="border-primary/20 bg-primary/10 hover:bg-primary/15 flex flex-col items-center rounded-xl border p-8 backdrop-blur-sm transition-all">
          <div className="mb-6 ">
            <BarChartIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold ">View</h2>
          <p className="text-primary mb-6 text-center">Explore and visualize your ingested data</p>
          <Button className="mt-auto w-full bg-purple-600 hover:bg-purple-700" asChild>
            <Link href="/view">Explore</Link>
          </Button>
        </div>
      </div>

      <footer className="text-primary mt-16 text-sm">© 2025 Hermes. All rights reserved.</footer>
    </main>
  )
}
