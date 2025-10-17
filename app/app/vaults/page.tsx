import { Suspense } from "react"
import { VaultsTable } from "./vaults-table"
import { getVaults } from "./actions"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
    title: "Vaults | Treasury",
    description: "Manage your budget category vaults",
}

export default async function VaultsPage() {
    const result = await getVaults()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vaults</h1>
                    <p className="text-muted-foreground">
                        Manage your budget categories and spending limits
                    </p>
                </div>
            </div>

            <Suspense fallback={<VaultsTableSkeleton />}>
                <VaultsTable initialVaults={result.data || []} />
            </Suspense>
        </div>
    )
}

function VaultsTableSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    )
}

