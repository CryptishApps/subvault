import { useState } from "react"
import { toast } from "sonner"
import { encodeFunctionData } from "viem"
import { getBaseAccountSDK } from "@/lib/base"
import { updatePaymentExecutionDate, storePaymentTransaction } from "../vaults/actions"

// USDC contract addresses
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// ERC-20 ABI for transfer function
const erc20Abi = [{
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
}] as const

interface Payment {
    id: string
    recipient_address: string
    amount: string
    next_execution_date: string | null
    status: string
    chain: string
}

export function usePaymentHandler(
    subAccountAddress: string | null,
    network: "base" | "base-sepolia",
    onPaymentUpdate: (paymentId: string, updates: Partial<Payment>) => void
) {
    const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null)

    const handlePayNow = async (payment: Payment) => {
        if (!subAccountAddress) {
            toast.error("Sub account not found. Please reconnect your wallet.")
            return
        }

        setPayingPaymentId(payment.id)
        const toastId = toast.loading("Sending payment...")

        try {
            // Get the Base Account SDK provider
            const sdk = getBaseAccountSDK()
            const provider = sdk.getProvider()

            // Get all accounts - first account is Sub Account with defaultAccount: 'sub'
            const allAccounts = await provider.request({
                method: 'eth_accounts',
                params: []
            }) as string[]

            // Use the chain stored on the payment record
            const paymentChain = payment.chain as 'base' | 'base-sepolia'
            const chainId = paymentChain === 'base' ? 8453 : 84532
            const usdcAddress = paymentChain === 'base' ? USDC_BASE : USDC_BASE_SEPOLIA
            const paymasterUrl = paymentChain === 'base' 
                ? process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE 
                : process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE_SEPOLIA

            // Encode USDC transfer (Sub Account will request spend permission automatically if needed)
            const data = encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [
                    payment.recipient_address as `0x${string}`,
                    BigInt(payment.amount)
                ],
            })

            console.log('allAccounts', allAccounts)
            console.log('subAccountAddress', subAccountAddress)

            // Send the transaction from Sub Account
            // First time: Shows "Skip further approvals" checkbox with Auto Spend Permissions
            // Subsequent: No popup, automatic execution using granted permissions
            const callsId = await provider.request({
                method: 'wallet_sendCalls',
                params: [{
                    version: "2.0.0",
                    atomicRequired: true,
                    chainId: `0x${chainId.toString(16)}`,
                    from: subAccountAddress, // Sub Account (first with defaultAccount: 'sub')
                    calls: [{
                        to: usdcAddress,
                        data,
                        value: '0x0',
                    }],
                    capabilities: {
                        paymasterUrl,
                    },
                }]
            }) as string

            // Get the call status to retrieve the transaction hash
            const status = await provider.request({
                method: 'wallet_getCallsStatus',
                params: [callsId]
            }) as any

            // Extract transaction hash from receipts
            const txHash = status?.receipts?.[0]?.transactionHash
            
            // Store transaction hash in database
            if (txHash) {
                await storePaymentTransaction(payment.id, txHash)
            }

            toast.success(`Payment sent successfully!`, { 
                id: toastId,
                description: txHash ? `Transaction: ${txHash.slice(0, 10)}...` : undefined
            })

            // Mark payment as completed
            await updatePaymentExecutionDate(payment.id, null)
            
            // Update local state
            onPaymentUpdate(payment.id, {
                next_execution_date: null,
                status: 'completed'
            })
        } catch (error) {
            console.error("Payment failed:", error)
            toast.error(
                error instanceof Error ? error.message : "Payment failed. Please try again.",
                { id: toastId }
            )
        } finally {
            setPayingPaymentId(null)
        }
    }

    return {
        handlePayNow,
        payingPaymentId,
    }
}

export function getPaymentButtonText(
    payment: Payment,
    isPaying: boolean
): string {
    if (isPaying) return "Paying..."

    // Check if payment date is in the future
    const now = new Date()
    const paymentDate = payment.next_execution_date ? new Date(payment.next_execution_date) : null
    const isFuture = paymentDate && paymentDate > now

    return isFuture ? "Pay Early" : "Pay Now"
}

