"use client"

import { useState } from "react"
import { ArrowUpRight } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"
import { formatDistance } from "date-fns"

interface Payment {
    id: string
    vault_id: string
    recipient_address: string
    recipient_name: string | null
    amount: string
    executed_count: number
    transaction_hashes: string[] | null
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

interface PaymentHistoryTableProps {
    payments: Payment[]
}

const ITEMS_PER_PAGE = 10

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
    const [currentPage, setCurrentPage] = useState(1)

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

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vault</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead className="w-[100px]">Transaction</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No payment history found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentPayments.map((payment) => {
                                // Get the latest transaction hash from the array
                                const txHashes = payment.transaction_hashes || []
                                const latestTxHash = Array.isArray(txHashes) && txHashes.length > 0 
                                    ? txHashes[txHashes.length - 1] 
                                    : null

                                return (
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
                                            <span className="text-sm text-muted-foreground">
                                                {formatDistance(
                                                    new Date(payment.created_at),
                                                    new Date(),
                                                    { addSuffix: true }
                                                )}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {latestTxHash ? (
                                                <a
                                                    href={payment.chain === "base" ? `https://basescan.org/tx/${latestTxHash}` : `https://sepolia.basescan.org/tx/${latestTxHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                    View
                                                    <ArrowUpRight className="h-3 w-3" />
                                                </a>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
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
        </div>
    )
}

