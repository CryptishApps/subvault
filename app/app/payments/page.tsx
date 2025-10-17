import { Suspense } from "react"
import { PaymentsView } from "./payments-view"
import { getPayments, getSubAccountAddress } from "../vaults/actions"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
    title: "Payments | Treasury",
    description: "View and manage your scheduled payments",
}

export default async function PaymentsPage() {
    const [paymentsResult, subAccountResult] = await Promise.all([
        getPayments(),
        getSubAccountAddress(),
    ])

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                    <p className="text-muted-foreground">
                        View your scheduled one-time and recurring payments
                    </p>
                </div>
            </div>

            <Suspense fallback={<PaymentsViewSkeleton />}>
                <PaymentsView 
                    initialPayments={paymentsResult.data || []} 
                    subAccountAddress={subAccountResult.data || null}
                />
            </Suspense>
        </div>
    )
}

function PaymentsViewSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    )
}

