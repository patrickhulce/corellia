export interface Configuration {
    browser: BrowserConfiguration
    accounts: ConnectedAccount[]

}

export enum ConnectedAccountType {
    GOOGLE = 'google',
    TARGET = 'target',
    AMAZON = 'amazon',
    COSTCO = 'costco',
}

export interface ConnectedAccount {
    id: string
    type: ConnectedAccountType
    username: string
    password: string
    decryptedPassword?: string
}

export interface BrowserConfiguration {
    headless: boolean
    executablePath: string
    userDataDir: string
}
