import { Repeat, CreditCard } from "lucide-react"
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
import { IconRepeat, IconCreditCard, IconShield } from "@tabler/icons-react"
import { checkOnboardingStatus } from "./vaults/actions"
import { OnboardingClient } from "./onboarding-client"
import { cookies } from "next/headers"

async function getDashboardStats() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            vaultsCount: 0,
            activePaymentsCount: 0,
            recurringPaymentsCount: 0,
            totalPaymentsCount: 0,
        }
    }

    // Fetch all data in parallel
    const [
        { count: vaultsCount },
        { data: activePayments },
        { count: totalPaymentsCount },
    ] = await Promise.all([
        // Get vaults count
        supabase
            .from("vaults")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),

        // Get active payments view
        supabase
            .from("active_payments_view")
            .select("id, is_recurring")
            .eq("user_id", user.id),

        // Get total payments count
        supabase
            .from("vault_spending_summary")
            .select("total_payments", { count: "exact", head: false })
            .eq("user_id", user.id)
    ])

    const recurringCount = activePayments?.filter(p => p.is_recurring).length || 0

    return {
        vaultsCount: vaultsCount || 0,
        activePaymentsCount: activePayments?.length || 0,
        recurringPaymentsCount: recurringCount,
        totalPaymentsCount: totalPaymentsCount || 0,
    }
}

export default async function AppPage() {
    const stats = await getDashboardStats()
    const { needsOnboarding, vaultCount } = await checkOnboardingStatus()

    // Get network from cookie (set by AuthProvider)
    const cookieStore = await cookies()
    const network = (cookieStore.get("network")?.value as "base" | "base-sepolia") || "base-sepolia"

    return (
        <>
            <OnboardingClient needsOnboarding={needsOnboarding} vaultCount={vaultCount} network={network} />
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="grid auto-rows-fr grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                    <VaultStatCard count={stats.vaultsCount} />

                    <Card className="@container/card">
                        <CardHeader>
                            <CardDescription>Active Payments</CardDescription>
                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                {stats.activePaymentsCount}
                            </CardTitle>
                            <CardAction>
                                <IconShield className="size-5" />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <div className="line-clamp-1 flex gap-2 font-medium text-sm">
                                Active spend permissions
                            </div>
                            <div className="text-muted-foreground text-sm">
                                Automatic payment schedules
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                            <Button variant="link" size="sm" className="text-foreground hover:text-foreground">
                                <IconShield className="size-4" />
                                View Payments
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="@container/card">
                        <CardHeader>
                            <CardDescription>Recurring Payments</CardDescription>
                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                {stats.recurringPaymentsCount}
                            </CardTitle>
                            <CardAction>
                                <Repeat className="size-5" />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <div className="line-clamp-1 flex gap-2 font-medium text-sm">
                                Automatic recurring
                            </div>
                            <div className="text-muted-foreground text-sm">
                                Subscriptions and regular payments
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                            <Button variant="link" size="sm" className="text-foreground hover:text-foreground">
                                <IconRepeat className="size-4" />
                                Manage Recurring
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
                            <Button variant="link" size="sm" className="text-foreground hover:text-foreground">
                                <IconCreditCard className="size-4" />
                                View All
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </>
    )
}
