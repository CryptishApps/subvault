import { Suspense } from "react"
import { getPayments, getSubAccountAddress } from "../../vaults/actions"
import { PaymentsTable } from "../payments-table"
import { TableSkeleton } from "../table-skeleton"

export const metadata = {
    title: "Upcoming Payments | Treasury",
    description: "View and manage your upcoming payments",
}

export default async function UpcomingPaymentsPage() {
    const [paymentsResult, subAccountResult] = await Promise.all([
        getPayments({ dateFilter: "upcoming", status: "active" }),
        getSubAccountAddress(),
    ])

    return (
        <Suspense fallback={<TableSkeleton rows={8} />}>
            <PaymentsTable 
                payments={paymentsResult.data || []} 
                subAccountAddress={subAccountResult.data || null}
                showCreateButton={false}
            />
        </Suspense>
    )
}

