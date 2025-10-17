import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getVaultByHandle, getPaymentsOverTime, getVaultPayments } from "../actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PaymentsOverTimeChart } from "@/components/charts/payments-over-time-chart"
import { VaultPaymentsTable } from "./vault-payments-table"

interface VaultPageProps {
    params: Promise<{
        handle: string
    }>
}

export async function generateMetadata({ params }: VaultPageProps) {
    const { handle } = await params
    const result = await getVaultByHandle(handle)

    return {
        title: result.data ? `${result.data.name} | Vaults` : "Vault | Treasury",
        description: result.data?.description || "View vault details and payment history",
    }
}

export default async function VaultPage({ params }: VaultPageProps) {
    const { handle } = await params
    const [vaultResult, paymentsResult] = await Promise.all([
        getVaultByHandle(handle),
        getVaultByHandle(handle).then(async (vaultRes) => {
            if (vaultRes.data) {
                return await Promise.all([
                    getPaymentsOverTime(vaultRes.data.id, 30),
                    getVaultPayments(vaultRes.data.id)
                ])
            }
            return [{ data: [] }, { data: [] }]
        })
    ])

    if (vaultResult.error || !vaultResult.data) {
        notFound()
    }

    const vault = vaultResult.data
    const [chartData, payments] = paymentsResult

    const getChainName = (chainId: number) => {
        return chainId === 8453 ? "Base" : "Base Sepolia"
    }

    const getChainBadgeColor = (chainId: number) => {
        return chainId === 8453 ? "default" : "secondary"
    }

    const formatAmount = (amount: string | number) => {
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
        const amountNum = (parsedAmount || 0) / 1_000_000
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amountNum)
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/app/vaults">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <span className="text-5xl">{vault.emoji}</span>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{vault.name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-muted-foreground text-sm">@{vault.handle}</p>
                                <Badge variant={getChainBadgeColor(vault.chain_id)} className="text-xs">
                                    {getChainName(vault.chain_id)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            {vault.description && (
                <Card>
                    <CardContent className="p-6">
                        <p className="text-muted-foreground">{vault.description}</p>
                    </CardContent>
                </Card>
            )}

            {/* Spend Permission Info */}
            {vault.vault_permission_hash && (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold mb-1">Spend Permission</h3>
                                <p className="text-sm text-muted-foreground">
                                    Active budget control for this vault
                                </p>
                            </div>
                            <Badge variant="default">Active</Badge>
                        </div>
                        {vault.vault_allowance && vault.vault_period_seconds && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Allowance</p>
                                    <p className="font-semibold">{formatAmount(vault.vault_allowance)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Period</p>
                                    <p className="font-semibold">
                                        {vault.vault_period_seconds === 2592000 ? '30 days' :
                                            vault.vault_period_seconds === 86400 ? '1 day' :
                                                vault.vault_period_seconds === 604800 ? '7 days' :
                                                    `${Math.floor(vault.vault_period_seconds / 86400)} days`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Payment Activity Chart */}
            <Suspense fallback={<ChartSkeleton />}>
                <PaymentsOverTimeChart
                    data={chartData.data}
                    showVaultBreakdown={false}
                    title="Payment Activity"
                    description={`Daily payment totals for ${vault.name}`}
                />
            </Suspense>

            {/* Payments Table */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight mb-4">Payment History</h2>
                <Suspense fallback={<TableSkeleton />}>
                    <VaultPaymentsTable payments={payments.data} />
                </Suspense>
            </div>
        </div>
    )
}

function ChartSkeleton() {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-[250px] w-full" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </CardContent>
        </Card>
    )
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

