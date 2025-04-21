'use client'

import {useContext} from 'react'
import {useParams} from 'next/navigation'
import {AccountConfigCard, NEW_ACCOUNT_ID} from '@/components/configuration/AccountConfigCard'
import {ConnectedAccount, ConnectedAccountType} from '@/lib/types'
import {ConfigurationContext} from '@/components/configuration/ConfigurationContext'
import {saveConfiguration} from '../../actions'

// Mock initial account for demonstration
const initialAccount: ConnectedAccount = {
  id: 'new',
  type: ConnectedAccountType.GOOGLE,
  username: '',
  password: '',
  ingestions: [],
}

export default function AccountUpdatePage() {
  const params = useParams()
  const accountId = params.id as string
  const config = useContext(ConfigurationContext)
  const account = config.accounts.find((account) => account.id === accountId) || initialAccount

  return (
    <AccountConfigCard
      initialAccount={account}
      onSave={async (account) => {
        const accounts = config.accounts.filter((a) => a.id !== account.id)
        if (account.id === NEW_ACCOUNT_ID) {
          account.id = crypto.randomUUID()
        }

        await saveConfiguration({...config, accounts: [...accounts, account]})
        window.location.href = `/configuration/account/${account.id}`
      }}
    />
  )
}
