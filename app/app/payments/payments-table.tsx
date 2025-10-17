"use client"

import { useCallback, useState } from "react"
import { MoreHorizontal, Trash2, ArrowUpRight, Send } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deletePayment, updatePaymentExecutionDate } from "../vaults/actions"
import { toast } from "sonner"
import { formatDistance, format, addSeconds } from "date-fns"
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

interface PaymentsTableProps {
    payments: Payment[]
    subAccountAddress: string | null
}

const ITEMS_PER_PAGE = 10

export function PaymentsTable({ payments: initialPayments, subAccountAddress }: PaymentsTableProps) {

    const { network } = useAuth()
    const [payments, setPayments] = useState<Payment[]>(initialPayments)
    const [currentPage, setCurrentPage] = useState(1)
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null)

    // Calculate pagination
    const totalPages = Math.ceil(payments.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const currentPayments = payments.slice(startIndex, endIndex)

    // Generate page numbers
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = []
        const showEllipsis = totalPages > 7

        if (!showEllipsis) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }

        pages.push(1)
        if (currentPage > 3) pages.push("ellipsis")
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push(i)
        }
        if (currentPage < totalPages - 2) pages.push("ellipsis")
        if (totalPages > 1) pages.push(totalPages)

        return pages
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

            const newTotalPages = Math.ceil((payments.length - 1) / ITEMS_PER_PAGE)
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages)
            }
        } catch (error) {
            toast.error("Failed to delete payment", { id: toastId })
        } finally {
            setIsDeleting(false)
        }
    }

    const formatAmount = (amount: string) => {
        const amountNum = parseFloat(amount) / 1_000_000
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amountNum)
    }

    const getFrequencyLabel = (seconds: number | null) => {
        if (!seconds) return "One-time"
        const days = seconds / 86400
        if (days === 1) return "Daily"
        if (days === 7) return "Weekly"
        if (days === 30) return "Monthly"
        if (days === 90) return "Quarterly"
        if (days === 365) return "Yearly"
        return `Every ${days} days`
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "active":
                return "default"
            case "pending":
                return "secondary"
            case "paused":
                return "outline"
            case "completed":
                return "outline"
            default:
                return "secondary"
        }
    }

    const shortenAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
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
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vault</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Next Payment</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No payments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentPayments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{payment.vault?.emoji}</span>
                                            <span className="font-medium">{payment.vault?.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {payment.recipient_name || "Unknown"}
                                            </span>
                                            <a
                                                href={`https://basescan.org/address/${payment.recipient_address}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                                            >
                                                {shortenAddress(payment.recipient_address)}
                                                <ArrowUpRight className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono">
                                        {formatAmount(payment.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={payment.is_recurring ? "default" : "secondary"}>
                                            {getFrequencyLabel(payment.frequency_seconds)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {payment.next_execution_date ? (
                                            <div className="flex flex-col">
                                                <span className="text-sm">
                                                    {format(
                                                        new Date(payment.next_execution_date),
                                                        "MMM d, yyyy"
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistance(
                                                        new Date(payment.next_execution_date),
                                                        new Date(),
                                                        { addSuffix: true }
                                                    )}
                                                </span>
                                            </div>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {payment.execution_mode}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusColor(payment.status)} className="capitalize">
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {payment.execution_mode === "manual" && 
                                             payment.status === "active" && 
                                             payment.next_execution_date && (
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
                                                            Pay Now
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => setDeletingPaymentId(payment.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                className={
                                    currentPage === 1
                                        ? "pointer-events-none opacity-50"
                                        : "cursor-pointer"
                                }
                            />
                        </PaginationItem>

                        {getPageNumbers().map((page, index) =>
                            page === "ellipsis" ? (
                                <PaginationItem key={`ellipsis-${index}`}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        onClick={() => setCurrentPage(page)}
                                        isActive={currentPage === page}
                                        className="cursor-pointer"
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            )
                        )}

                        <PaginationItem>
                            <PaginationNext
                                onClick={() =>
                                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                                }
                                className={
                                    currentPage === totalPages
                                        ? "pointer-events-none opacity-50"
                                        : "cursor-pointer"
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

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
        </div>
    )
}

