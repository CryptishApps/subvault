import { CreditCard, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { VaultStatCard } from "@/components/cards/vault-stat-card"
import { Button } from "@/components/ui/button"
import { IconCreditCard, IconShield, IconClock, IconRepeat } from "@tabler/icons-react"
import { checkOnboardingStatus, getPaymentsOverTime } from "./vaults/actions"
import { OnboardingClient } from "./onboarding-client"
import { cookies } from "next/headers"
import { PaymentsOverTimeChart } from "@/components/charts/payments-over-time-chart"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUnits } from "viem"
import Link from "next/link"

// Helper function to format USDC amounts (6 decimals) as currency
function formatUSDC(amount: string): string {
    const formatted = formatUnits(BigInt(amount), 6)
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(parseFloat(formatted))
}

async function getDashboardStats() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            vaultsCount: 0,
            activePaymentsSum: "0",
            dueTodaySum: "0",
            totalPaymentsCount: 0,
        }
    }

    // Get today's date in UTC (start and end of day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()

    // Fetch all data in parallel
    const [
        { count: vaultsCount },
        { data: activePayments },
        { data: paymentsDueToday },
        { count: totalPaymentsCount },
    ] = await Promise.all([
        // Get vaults count
        supabase
            .from("vaults")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),

        // Get active payments with amounts
        supabase
            .from("active_payments_view")
            .select("amount")
            .eq("user_id", user.id),

        // Get payments due today
        supabase
            .from("active_payments_view")
            .select("amount")
            .eq("user_id", user.id)
            .gte("next_occurrence_date", todayStart)
            .lt("next_occurrence_date", todayEnd),

        // Get total payments count
        supabase
            .from("vault_spending_summary")
            .select("total_payments", { count: "exact", head: false })
            .eq("user_id", user.id)
    ])

    // Sum all active payment amounts
    const activePaymentsSum = activePayments?.reduce((sum, payment) => {
        return sum + BigInt(payment.amount || "0")
    }, BigInt(0)) || BigInt(0)

    // Sum all payments due today
    const dueTodaySum = paymentsDueToday?.reduce((sum, payment) => {
        return sum + BigInt(payment.amount || "0")
    }, BigInt(0)) || BigInt(0)

    return {
        vaultsCount: vaultsCount || 0,
        activePaymentsSum: activePaymentsSum.toString(),
        dueTodaySum: dueTodaySum.toString(),
        totalPaymentsCount: totalPaymentsCount || 0,
    }
}

export default async function AppPage() {
    const stats = await getDashboardStats()
    const { needsOnboarding, vaultCount, hasSubAccount } = await checkOnboardingStatus()
    const paymentsData = await getPaymentsOverTime(undefined, 30) // All vaults, 30 days

    // Get network from cookie (set by AuthProvider)
    const cookieStore = await cookies()
    const network = (cookieStore.get("network")?.value as "base" | "base-sepolia") || "base-sepolia"

    return (
        <>
            <OnboardingClient needsOnboarding={needsOnboarding} vaultCount={vaultCount} hasSubAccount={hasSubAccount} network={network} />
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

                <div className="grid auto-rows-fr grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                    <VaultStatCard count={stats.vaultsCount} />

                    <Card className="@container/card">
                        <CardHeader>
                            <CardDescription>Active Payments</CardDescription>
                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                {formatUSDC(stats.activePaymentsSum)}
                            </CardTitle>
                            <CardAction>
                                <IconShield className="size-5" />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <div className="line-clamp-1 flex gap-2 font-medium text-sm">
                                Total active payment amounts
                            </div>
                            <div className="text-muted-foreground text-sm">
                                Sum of all scheduled payments
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                            <Button variant="link" size="sm" className="text-foreground hover:text-foreground" asChild>
                                <Link href="/app/payments/upcoming">
                                    <IconShield className="size-4" />
                                    View Upcoming Payments
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="@container/card">
                        <CardHeader>
                            <CardDescription>Due Today</CardDescription>
                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                {formatUSDC(stats.dueTodaySum)}
                            </CardTitle>
                            <CardAction>
                                <Clock className="size-5" />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <div className="line-clamp-1 flex gap-2 font-medium text-sm">
                                Payments scheduled for today
                            </div>
                            <div className="text-muted-foreground text-sm">
                                Total amount due today
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                            <Button asChild variant="link" size="sm" className="text-foreground hover:text-foreground">
                                <Link href="/app/payments/overdue">
                                    <IconClock className="size-4" />
                                    View Today&apos;s Payments
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="@container/card">
                        <CardHeader>
                            <CardDescription>Total Payments</CardDescription>
                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                {stats.totalPaymentsCount}
                            </CardTitle>
                            <CardAction>
                                <CreditCard className="size-5" />
                            </CardAction>
                        </CardHeader>
                        <CardContent className="flex-col items-start gap-1.5 text-sm">
                            <div className="line-clamp-1 flex gap-2 font-medium">
                                All time
                            </div>
                            <div className="text-muted-foreground">
                                One-time and recurring
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                            <Button asChild variant="link" size="sm" className="text-foreground hover:text-foreground">
                                <Link href="/app/payments/history">
                                    <IconCreditCard className="size-4" />
                                    View History
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                {/* Payment Activity Chart */}
                <div className="px-4 lg:px-6">
                    <Suspense fallback={<ChartSkeleton />}>
                        <PaymentsOverTimeChart
                            data={paymentsData.data}
                            showVaultBreakdown={true}
                            title="Treasury Overview"
                            description="Daily payment activity across all vaults"
                        />
                    </Suspense>
                </div>
            </div>
        </>
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
