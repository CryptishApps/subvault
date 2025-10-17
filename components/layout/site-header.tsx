"use client"

import { IconCirclePlusFilled } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { useWalletBalances } from "@/hooks/use-wallet-balances"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "../auth-provider"
import { Badge } from "../ui/badge"

export function SiteHeader() {
    const { network } = useAuth()
    const { eth, usdc, loading } = useWalletBalances()

    const NetworkBadge = () => {
        return (
            <Badge variant="outline">{network === "base" ? "Base Mainnet" : "Base Sepolia"}</Badge>
        )
    }

    return (
        <header className="bg-background/90 sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                {loading ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-baseline gap-1.5">
                            <NetworkBadge />
                        </div>
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className="flex items-baseline gap-1.5">
                            <NetworkBadge />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold">${usdc}</span>
                            <span className="text-xs text-muted-foreground">USDC</span>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold">{eth}</span>
                            <span className="text-xs text-muted-foreground">ETH</span>
                        </div>
                    </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" className="hidden h-7 sm:flex">
                        <IconCirclePlusFilled />
                        <span>Create Vault</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}