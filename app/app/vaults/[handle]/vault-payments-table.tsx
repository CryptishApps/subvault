"use client"

import { format } from "date-fns"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from "@/components/ui/empty"

interface Payment {
    id: string
    recipient_address: string
    recipient_name: string | null
    description: string | null
    amount: string
    status: string
    last_payment_date: string | null
    next_payment_date: string | null
    executed_count: number
    created_at: string
    chain: string
}

interface VaultPaymentsTableProps {
    payments: Payment[]
}

export function VaultPaymentsTable({ payments }: VaultPaymentsTableProps) {
    const formatAmount = (amount: string) => {
        const amountNum = parseFloat(amount) / 1_000_000
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amountNum)
    }

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
            completed: { variant: "default", label: "Completed" },
            active: { variant: "secondary", label: "Active" },
            pending: { variant: "outline", label: "Pending" },
            cancelled: { variant: "destructive", label: "Cancelled" },
            paused: { variant: "outline", label: "Paused" },
        }
        
        const config = variants[status] || { variant: "outline" as const, label: status }
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    if (payments.length === 0) {
        return (
            <Card className="p-12">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="20" height="14" x="2" y="5" rx="2" />
                                <line x1="2" x2="22" y1="10" y2="10" />
                            </svg>
                        </EmptyMedia>
                        <EmptyTitle>No Payments Yet</EmptyTitle>
                        <EmptyDescription>
                            This vault doesn&apos;t have any payments yet. Create your first payment to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Card>
        )
    }

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Executions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.map((payment) => (
                        <TableRow key={payment.id}>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {payment.recipient_name || "Unknown Recipient"}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {truncateAddress(payment.recipient_address)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-muted-foreground">
                                    {payment.description || "—"}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className="font-semibold">
                                    {formatAmount(payment.amount)}
                                </span>
                            </TableCell>
                            <TableCell>
                                {getStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    {payment.last_payment_date ? (
                                        <>
                                            <span className="text-sm">
                                                {format(new Date(payment.last_payment_date), "MMM d, yyyy")}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(payment.last_payment_date), "h:mm a")}
                                            </span>
                                        </>
                                    ) : payment.next_payment_date ? (
                                        <>
                                            <span className="text-sm text-muted-foreground">Scheduled</span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(payment.next_payment_date), "MMM d, yyyy")}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <span className="text-sm">
                                    {payment.executed_count || 0}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    )
}

