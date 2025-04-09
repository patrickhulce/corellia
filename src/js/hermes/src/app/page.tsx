import {Button} from '@/components/ui/button'
import Link from 'next/link'
import {BarChartIcon, DownloadCloudIcon, UserCogIcon} from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-white">Welcome to Hermes</h1>
        <p className="text-xl text-slate-300">Choose an option to get started</p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        {/* Authenticate Card */}
        <div className="flex flex-col items-center rounded-xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm transition-all hover:bg-white/15">
          <div className="mb-6 text-white">
            <UserCogIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold text-white">Configure</h2>
          <p className="mb-6 text-center text-slate-300">
            Connect your accounts to access your data
          </p>
          <Button className="mt-auto w-full bg-blue-600 hover:bg-blue-700" asChild>
            <Link href="/auth">Connect Accounts</Link>
          </Button>
        </div>

        {/* Ingest Card */}
        <div className="flex flex-col items-center rounded-xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm transition-all hover:bg-white/15">
          <div className="mb-6 text-white">
            <DownloadCloudIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold text-white">Ingest</h2>
          <p className="mb-6 text-center text-slate-300">
            Download your data from your connected accounts
          </p>
          <Button className="mt-auto w-full bg-green-600 hover:bg-green-700" asChild>
            <Link href="/ingest">Download Data</Link>
          </Button>
        </div>

        {/* View Card */}
        <div className="flex flex-col items-center rounded-xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm transition-all hover:bg-white/15">
          <div className="mb-6 text-white">
            <BarChartIcon size={96} strokeWidth={1.5} />
          </div>
          <h2 className="mb-4 text-2xl font-semibold text-white">View</h2>
          <p className="mb-6 text-center text-slate-300">
            Explore and visualize your ingested data
          </p>
          <Button className="mt-auto w-full bg-purple-600 hover:bg-purple-700" asChild>
            <Link href="/view">Explore</Link>
          </Button>
        </div>
      </div>

      <footer className="mt-16 text-sm text-slate-400">
        © 2025 Hermes. All rights reserved.
      </footer>
    </main>
  )
}
