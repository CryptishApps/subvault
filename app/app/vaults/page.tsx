import { Suspense } from "react"
import { VaultsGrid } from "./vaults-grid"
import { getVaultsWithStats } from "./actions"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
    title: "Vaults | Treasury",
    description: "Manage your budget category vaults",
}

export default async function VaultsPage() {
    const vaultsResult = await getVaultsWithStats()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vaults</h1>
                    <p className="text-muted-foreground">
                        Organize your spending into budget categories
                    </p>
                </div>
            </div>

            <Suspense fallback={<VaultsGridSkeleton />}>
                <VaultsGrid initialVaults={vaultsResult.data || []} />
            </Suspense>
        </div>
    )
}

function VaultsGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="flex flex-col">
                    <CardContent className="flex flex-col flex-1 p-6 gap-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                                <Skeleton className="h-10 w-10 rounded" />
                                <div className="flex flex-col gap-2 flex-1">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-8" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-12 w-full" />
                        <div className="flex flex-col gap-3 pt-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                        <Skeleton className="h-9 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

