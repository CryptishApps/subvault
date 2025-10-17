import { createBaseAccountSDK } from "@base-org/account"
import { base, baseSepolia } from "viem/chains"

let sdkInstance: ReturnType<typeof createBaseAccountSDK> | null = null

export interface SubAccountData {
  address: `0x${string}`
  factory?: `0x${string}`
  factoryData?: `0x${string}`
}

/**
 * Get singleton SDK instance with auto Sub Account creation
 */
export function getBaseAccountSDK() {
  if (!sdkInstance) {
    // Build paymaster URLs from environment
    const paymasterUrls: Record<number, string> = {}
    
    // Add Base mainnet paymaster if configured
    if (process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE) {
      paymasterUrls[base.id] = process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE
    }
    
    // Add Base Sepolia paymaster if configured
    if (process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE_SEPOLIA) {
      paymasterUrls[baseSepolia.id] = process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE_SEPOLIA
    }

    sdkInstance = createBaseAccountSDK({
      appName: "SubVault",
      appLogoUrl: "/icon-192.webp",
      appChainIds: [base.id, baseSepolia.id],
      // Auto-create Sub Account on connect (one per user per app)
      subAccounts: {
        creation: 'on-connect',
        defaultAccount: 'sub',
      },
      // Configure paymaster URLs at SDK level (protects URLs from being in transaction code)
      paymasterUrls: Object.keys(paymasterUrls).length > 0 ? paymasterUrls : undefined,
    })
  }
  return sdkInstance
}

/**
 * Get the Sub Account for the current user
 * With auto-creation enabled, this will be automatically created on first connect
 */
export async function getSubAccount() {
  const sdk = getBaseAccountSDK()
  const provider = sdk.getProvider()

  try {
    // Get accounts - sub account is first in array with defaultAccount: 'sub'
    const accounts = await provider.request({
      method: "eth_accounts",
      params: [],
    }) as string[]

    if (accounts.length === 0) {
      throw new Error("No accounts found. User may need to connect wallet.")
    }

    return {
      address: accounts[0], // Sub Account is default/first with defaultAccount: 'sub'
      universalAddress: accounts.length > 1 ? accounts[1] : accounts[0],
    }
  } catch (error) {
    console.error("Error getting sub account:", error)
    throw new Error("Failed to get sub account")
  }
}

// Paymaster URLs are now configured in the SDK initialization above
// No need to expose them separately