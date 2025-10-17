"use client"

import { useState } from "react"
import { Calendar, Table as TableIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaymentsTable } from "./payments-table"
import { PaymentsCalendar } from "./payments-calendar"

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

interface PaymentsViewProps {
    initialPayments: Payment[]
    subAccountAddress: string | null
}

export function PaymentsView({ initialPayments, subAccountAddress }: PaymentsViewProps) {
    const [view, setView] = useState<"table" | "calendar">("table")

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Tabs value={view} onValueChange={(v) => setView(v as "table" | "calendar")}>
                    <TabsList>
                        <TabsTrigger value="table" className="gap-2">
                            <TableIcon className="h-4 w-4" />
                            Table
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="gap-2">
                            <Calendar className="h-4 w-4" />
                            Calendar
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {view === "table" ? (
                <PaymentsTable payments={initialPayments} subAccountAddress={subAccountAddress} />
            ) : (
                <PaymentsCalendar payments={initialPayments} subAccountAddress={subAccountAddress} />
            )}
        </div>
    )
}

