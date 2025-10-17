import { useState } from "react"
import { toast } from "sonner"
import { getBaseAccountSDK } from "@/lib/base"
import { updatePaymentExecutionDate } from "../vaults/actions"

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
        const toastId = toast.loading("Processing payment...")

        try {
            // Get the Base Account SDK provider
            const sdk = getBaseAccountSDK()
            const provider = sdk.getProvider()

            // Convert amount to hex (already in smallest unit - USDC has 6 decimals)
            const amountHex = `0x${BigInt(payment.amount).toString(16)}`

            // Use the chain stored on the payment record
            const paymentChain = payment.chain as 'base' | 'base-sepolia'
            const chainId = paymentChain === 'base' ? 8453 : 84532
            const paymasterUrl = paymentChain === 'base' 
                ? process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE 
                : process.env.NEXT_PUBLIC_PAYMASTER_URL_BASE_SEPOLIA

            // Send the payment using wallet_sendCalls
            const response = await provider.request({
                method: 'wallet_sendCalls',
                params: [{
                    version: "2.0",
                    atomicRequired: true,
                    chainId: `0x${chainId.toString(16)}`,
                    from: subAccountAddress,
                    calls: [{
                        to: payment.recipient_address,
                        data: '0x', // Empty data for simple transfer
                        value: amountHex,
                    }],
                    capabilities: {
                        paymasterUrl,
                    },
                }]
            })

            // Extract the transaction hash from the response
            const txHash = typeof response === 'string' ? response : (response as any)?.hash || 'unknown'
            toast.success(`Payment sent successfully!`, { id: toastId })

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

