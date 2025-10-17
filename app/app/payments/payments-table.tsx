"use client"

import { useState } from "react"
import { MoreHorizontal, Trash2, ArrowUpRight, Send, Plus } from "lucide-react"
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
import { deletePayment } from "../vaults/actions"
import { toast } from "sonner"
import { formatDistance, format } from "date-fns"
import { useAuth } from "@/components/auth-provider"
import { usePaymentHandler, getPaymentButtonText } from "./use-payment-handler"
import { CreatePaymentModal } from "@/components/modals/create-payment"
import { IconLocationDollar } from "@tabler/icons-react"

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

interface PaymentsTableProps {
    payments: Payment[]
    subAccountAddress: string | null
    showCreateButton?: boolean
}

const ITEMS_PER_PAGE = 10

export function PaymentsTable({ payments: initialPayments, subAccountAddress, showCreateButton = false }: PaymentsTableProps) {
    const { network } = useAuth()
    const [payments, setPayments] = useState<Payment[]>(initialPayments)
    const [currentPage, setCurrentPage] = useState(1)
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const { handlePayNow, payingPaymentId } = usePaymentHandler(
        subAccountAddress,
        network,
        (paymentId, updates) => {
            setPayments(prev => prev.map(p => 
                p.id === paymentId ? { ...p, ...updates } : p
            ))
        }
    )

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

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vault</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Scheduled Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32">
                                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                                        <p className="text-sm text-muted-foreground">No payments found.</p>
                                        {showCreateButton && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setShowCreateModal(true)}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create Payment
                                            </Button>
                                        )}
                                    </div>
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
                                                href={payment.chain === "base" ? `https://basescan.org/address/${payment.recipient_address}` : `https://sepolia.basescan.org/address/${payment.recipient_address}`}
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
                                        <Badge variant={getStatusColor(payment.status)} className="capitalize">
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {payment.status === "active" && payment.next_execution_date && (
                                                <Button
                                                    variant="default"
                                                    size="xs"
                                                    onClick={() => handlePayNow(payment)}
                                                    disabled={payingPaymentId === payment.id}
                                                >
                                                    {payingPaymentId === payment.id ? (
                                                        getPaymentButtonText(payment, true)
                                                    ) : (
                                                        <>
                                                            <IconLocationDollar className="mr-1 h-2 w-2" />
                                                            {getPaymentButtonText(payment, false)}
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

            {showCreateButton && (
                <CreatePaymentModal
                    open={showCreateModal}
                    onOpenChange={setShowCreateModal}
                />
            )}
        </div>
    )
}

