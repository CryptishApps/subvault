import { Suspense } from "react"
import { getPayments, getSubAccountAddress } from "../../vaults/actions"
import { OverduePaymentsView } from "./overdue-view"
import { TableSkeleton } from "../table-skeleton"

export const metadata = {
    title: "Overdue Payments | Treasury",
    description: "View and manage your overdue payments",
}

export default async function OverduePaymentsPage() {
    const [paymentsResult, subAccountResult] = await Promise.all([
        getPayments({ dateFilter: "overdue", status: "active" }),
        getSubAccountAddress(),
    ])

    return (
        <Suspense fallback={<TableSkeleton rows={8} />}>
            <OverduePaymentsView 
                initialPayments={paymentsResult.data || []} 
                subAccountAddress={subAccountResult.data || null}
            />
        </Suspense>
    )
}

