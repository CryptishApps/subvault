"use client"

import * as React from "react"
import { useCallback, useState } from "react"
import { Trash2, ArrowUpRight, Send } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deletePayment, updatePaymentExecutionDate } from "../vaults/actions"
import { toast } from "sonner"
import { format, isSameDay, addSeconds } from "date-fns"
import { getBaseAccountSDK } from "@/lib/base"
import { useAuth } from "@/components/auth-provider"

interface Payment {
    id: string
    vault_id: string
    recipient_address: string
    recipient_name: string | null
    amount: string
    is_recurring: boolean
    frequency_seconds: number | null
    next_execution_date: string | null
    execution_mode: string
    status: string
    description: string | null
    created_at: string
    vault: {
        id: string
        name: string
        emoji: string
        handle: string
    } | null
}

interface PaymentsCalendarProps {
    payments: Payment[]
    subAccountAddress: string | null
}

export function PaymentsCalendar({ payments: initialPayments, subAccountAddress }: PaymentsCalendarProps) {
    const { network } = useAuth()
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [payments, setPayments] = useState<Payment[]>(initialPayments)
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null)

    // Get all dates that have payments
    const paymentDates = payments
        .filter((p) => p.next_execution_date)
        .map((p) => new Date(p.next_execution_date!))

    // Get payments for selected date
    const selectedDatePayments = date
        ? payments.filter(
              (p) =>
                  p.next_execution_date &&
                  isSameDay(new Date(p.next_execution_date), date)
          )
        : []

    const formatAmount = (amount: string) => {
        const amountNum = parseFloat(amount) / 1_000_000
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amountNum)
    }

    const shortenAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const handleDelete = async () => {
        if (!deletingPaymentId) return

        setIsDeleting(true)
        const toastId = toast.loading("Deleting payment...")

        try {
            const result = await deletePayment(deletingPaymentId)

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }

            toast.success("Payment deleted successfully!", { id: toastId })
            setPayments((prev) => prev.filter((p) => p.id !== deletingPaymentId))
            setDeletingPaymentId(null)
        } catch (error) {
            toast.error("Failed to delete payment", { id: toastId })
        } finally {
            setIsDeleting(false)
        }
    }

    const handlePayNow = useCallback(async (payment: Payment) => {
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

            // Send the payment using wallet_sendCalls
            // Paymaster is configured at SDK level, so no need to pass it here
            const callsId = await provider.request({
                method: 'wallet_sendCalls',
                params: [{
                    version: "2.0",
                    atomicRequired: true,
                    chainId: `0x${(network === 'base' ? 8453 : 84532).toString(16)}`, // Base Sepolia (0x14a34) - change to 8453 (0x2105) for mainnet
                    from: subAccountAddress,
                    calls: [{
                        to: payment.recipient_address,
                        data: '0x', // Empty data for simple transfer
                        value: amountHex,
                    }],
                }]
            }) as string

            toast.success(`Payment sent! Calls ID: ${callsId}`, { id: toastId })

            // Update the payment's next execution date if recurring
            if (payment.is_recurring && payment.frequency_seconds) {
                const nextDate = addSeconds(new Date(), payment.frequency_seconds)
                await updatePaymentExecutionDate(payment.id, nextDate.toISOString())
                
                // Update local state
                setPayments(prev => prev.map(p => 
                    p.id === payment.id 
                        ? { ...p, next_execution_date: nextDate.toISOString() }
                        : p
                ))
            } else {
                // For one-time payments, set next_execution_date to null
                await updatePaymentExecutionDate(payment.id, null)
                
                // Update local state
                setPayments(prev => prev.map(p => 
                    p.id === payment.id 
                        ? { ...p, next_execution_date: null, status: 'completed' }
                        : p
                ))
            }
        } catch (error) {
            console.error("Payment failed:", error)
            toast.error(
                error instanceof Error ? error.message : "Payment failed. Please try again.",
                { id: toastId }
            )
        } finally {
            setPayingPaymentId(null)
        }
    }, [subAccountAddress, network])

    return (
        <>
            <Card className="gap-0 p-0 w-auto">
                <CardContent className="relative p-0 md:pr-80">
                    <div className="flex justify-center w-full p-6">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            defaultMonth={date || new Date()}
                            showOutsideDays={false}
                            modifiers={{
                                hasPayment: paymentDates,
                            }}
                            modifiersClassNames={{
                                hasPayment: "[&>button]:font-bold [&>button]:bg-primary/10",
                            }}
                            className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
                            formatters={{
                                formatWeekdayName: (date) => {
                                    return date.toLocaleString("en-US", { weekday: "short" })
                                },
                            }}
                        />
                    </div>
                    <div className="inset-y-0 right-0 flex w-full flex-col border-t md:absolute md:w-80 md:border-t-0 md:border-l">
                        <div className="border-b bg-muted/30 px-6 py-4">
                            <h3 className="font-semibold">
                                {date ? format(date, "MMMM d, yyyy") : "Select a date"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {selectedDatePayments.length === 0
                                    ? "No payments scheduled"
                                    : `${selectedDatePayments.length} payment${selectedDatePayments.length === 1 ? "" : "s"} scheduled`}
                            </p>
                        </div>
                        <ScrollArea className="flex-1 md:max-h-[calc(100vh-300px)]">
                            <div className="flex flex-col gap-3 p-6">
                                {selectedDatePayments.length === 0 ? (
                                    <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
                                        No payments scheduled for this date
                                    </div>
                                ) : (
                                    selectedDatePayments.map((payment) => (
                                        <Card key={payment.id} className="p-4">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">
                                                            {payment.vault?.emoji}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">
                                                                {payment.vault?.name}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {payment.recipient_name ||
                                                                    "Unknown Recipient"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {payment.execution_mode === "manual" && 
                                                         payment.status === "active" && (
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                onClick={() => handlePayNow(payment)}
                                                                disabled={payingPaymentId === payment.id}
                                                            >
                                                                {payingPaymentId === payment.id ? (
                                                                    "Paying..."
                                                                ) : (
                                                                    <>
                                                                        <Send className="mr-2 h-3 w-3" />
                                                                        Pay
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive"
                                                            onClick={() =>
                                                                setDeletingPaymentId(payment.id)
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-semibold">
                                                        {formatAmount(payment.amount)}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <Badge
                                                            variant={
                                                                payment.is_recurring
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                            className="text-xs"
                                                        >
                                                            {payment.is_recurring
                                                                ? "Recurring"
                                                                : "One-time"}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs capitalize"
                                                        >
                                                            {payment.execution_mode}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <a
                                                        href={`https://basescan.org/address/${payment.recipient_address}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:underline inline-flex items-center gap-1"
                                                    >
                                                        {shortenAddress(payment.recipient_address)}
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </a>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs capitalize"
                                                    >
                                                        {payment.status}
                                                    </Badge>
                                                </div>

                                                {payment.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {payment.description}
                                                    </p>
                                                )}
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!deletingPaymentId} onOpenChange={() => setDeletingPaymentId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this payment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

