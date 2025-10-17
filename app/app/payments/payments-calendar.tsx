"use client"

import * as React from "react"
import { useState } from "react"
import { Trash2, ArrowUpRight, Send, Plus } from "lucide-react"
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
import { deletePayment } from "../vaults/actions"
import { toast } from "sonner"
import { format, isSameDay } from "date-fns"
import { useAuth } from "@/components/auth-provider"
import { usePaymentHandler, getPaymentButtonText } from "./use-payment-handler"

interface Payment {
    id: string
    vault_id: string
    recipient_address: string
    recipient_name: string | null
    amount: string
    next_execution_date: string | null
    status: string
    description: string | null
    created_at: string
    series_id: string | null
    chain: string
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
    showCreateButton?: boolean
    onCreateClick?: () => void
}

export function PaymentsCalendar({ payments: initialPayments, subAccountAddress, showCreateButton = false, onCreateClick }: PaymentsCalendarProps) {
    const { network } = useAuth()
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [payments, setPayments] = useState<Payment[]>(initialPayments)
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const { handlePayNow, payingPaymentId } = usePaymentHandler(
        subAccountAddress,
        network,
        (paymentId, updates) => {
            setPayments(prev => prev.map(p => 
                p.id === paymentId ? { ...p, ...updates } : p
            ))
        }
    )

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
                                    <div className="flex h-32 flex-col items-center justify-center gap-3 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            {payments.length === 0 ? "No payments found" : "No payments scheduled for this date"}
                                        </p>
                                        {showCreateButton && payments.length === 0 && onCreateClick && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={onCreateClick}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create Payment
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    selectedDatePayments.map((payment) => (
                                        <Card key={payment.id} className="p-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">
                                                        {payment.vault?.emoji}
                                                    </span>
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-sm font-medium">
                                                            {payment.vault?.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {payment.recipient_name ||
                                                                "Unknown Recipient"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-semibold">
                                                        {formatAmount(payment.amount)}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs capitalize"
                                                    >
                                                        {payment.status}
                                                    </Badge>
                                                </div>

                                                <div className="text-xs text-muted-foreground">
                                                    <a
                                                        href={`https://basescan.org/address/${payment.recipient_address}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hover:underline inline-flex items-center gap-1"
                                                    >
                                                        {shortenAddress(payment.recipient_address)}
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </a>
                                                </div>

                                                {payment.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {payment.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-2 pt-2 border-t">
                                                    {payment.status === "active" && (
                                                        <Button
                                                            variant="default"
                                                            size="xs"
                                                            onClick={() => handlePayNow(payment)}
                                                            disabled={payingPaymentId === payment.id}
                                                            className="flex-1"
                                                        >
                                                            {payingPaymentId === payment.id ? (
                                                                getPaymentButtonText(payment, true)
                                                            ) : (
                                                                <>
                                                                    <Send className="mr-1 h-2 w-2" />
                                                                    {getPaymentButtonText(payment, false)}
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setDeletingPaymentId(payment.id)
                                                        }
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
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

