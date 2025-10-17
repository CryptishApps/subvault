"use client"

import { PaymentsTable } from "../payments-table"

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

interface OverduePaymentsViewProps {
    initialPayments: Payment[]
    subAccountAddress: string | null
}

export function OverduePaymentsView({ initialPayments, subAccountAddress }: OverduePaymentsViewProps) {
    return (
        <div className="space-y-6">
            {initialPayments.length > 0 ? (
                <PaymentsTable 
                    payments={initialPayments} 
                    subAccountAddress={subAccountAddress}
                    showCreateButton={false}
                />
            ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-center rounded-md border border-dashed">
                    <p className="text-sm text-muted-foreground">No overdue payments</p>
                </div>
            )}
        </div>
    )
}

