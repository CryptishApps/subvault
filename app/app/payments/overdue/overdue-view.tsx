"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaymentsTable } from "../payments-table"
import { CreatePaymentModal } from "@/components/modals/create-payment"

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
    const [showCreateModal, setShowCreateModal] = useState(false)

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
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Payment
                    </Button>
                </div>
            )}

            <CreatePaymentModal
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
            />
        </div>
    )
}

