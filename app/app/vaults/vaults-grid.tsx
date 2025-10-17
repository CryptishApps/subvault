"use client"

import { useState, useEffect } from "react"
import { MoreVertical, Pencil, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from "@/components/ui/empty"
import { CreateVaultModal } from "@/components/modals/create-vault"
import { deleteVault } from "./actions"
import { toast } from "sonner"

interface Vault {
    id: string
    name: string
    handle: string
    emoji: string
    description: string | null
    chain_id: number
    created_at: string
    stats: {
        total_payments: number
        active_payments: number
        completed_payments: number
        total_spent: number
    }
}

interface VaultsGridProps {
    initialVaults: Vault[]
}

export function VaultsGrid({ initialVaults }: VaultsGridProps) {
    const router = useRouter()
    const [vaults, setVaults] = useState<Vault[]>(initialVaults)
    const [editingVault, setEditingVault] = useState<Vault | null>(null)
    const [deletingVaultId, setDeletingVaultId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)

    // Sync local state when server data updates (after router.refresh())
    useEffect(() => {
        setVaults(initialVaults)
    }, [initialVaults])

    const handleDelete = async () => {
        if (!deletingVaultId) return

        setIsDeleting(true)
        const toastId = toast.loading("Deleting vault...")

        try {
            const result = await deleteVault(deletingVaultId)

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }

            toast.success("Vault deleted successfully!", { id: toastId })
            setDeletingVaultId(null)
            router.refresh()
        } catch (error) {
            toast.error("Failed to delete vault", { id: toastId })
        } finally {
            setIsDeleting(false)
        }
    }

    const formatAmount = (amount: number | string) => {
        // Parse the amount if it's a string, handle null/undefined as 0
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
        const amountNum = (parsedAmount || 0) / 1_000_000
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amountNum)
    }

    const getChainBadgeColor = (chainId: number) => {
        return chainId === 8453 ? "default" : "secondary"
    }

    const getChainName = (chainId: number) => {
        return chainId === 8453 ? "Base" : "Base Sepolia"
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vaults.map((vault) => (
                    <Card key={vault.id} className="flex flex-col hover:shadow-lg transition-shadow">
                        <CardContent className="flex flex-col flex-1 p-6 gap-4">
                            {/* Header with emoji and actions */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-4xl flex-shrink-0">{vault.emoji}</span>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <h3 className="font-semibold text-lg truncate">{vault.name}</h3>
                                        <p className="text-sm text-muted-foreground truncate">@{vault.handle}</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">Open menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditingVault(vault)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => setDeletingVaultId(vault.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Chain badge */}
                            <div className="flex items-center gap-2">
                                <Badge variant={getChainBadgeColor(vault.chain_id)} className="text-xs capitalize">
                                    {getChainName(vault.chain_id)}
                                </Badge>
                            </div>

                            {/* Description */}
                            {vault.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {vault.description}
                                </p>
                            )}

                            {/* Stats */}
                            <div className="flex flex-col gap-3 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Total Spent</span>
                                    <span className="font-semibold">
                                        {formatAmount(vault.stats.total_spent)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Queued Payments</span>
                                    <span className="font-semibold">
                                        {vault.stats.active_payments}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button asChild className="flex-1" size="sm">
                                    <Link href={`/app/vaults/${vault.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Create New Vault Card */}
                <Card 
                    className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer border-dashed"
                    onClick={() => setShowCreateModal(true)}
                >
                    <CardContent className="flex flex-col flex-1 p-6">
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M5 12h14" />
                                        <path d="M12 5v14" />
                                    </svg>
                                </EmptyMedia>
                                <EmptyTitle>Create New Vault</EmptyTitle>
                                <EmptyDescription>
                                    Add a new budget category to organize your payments
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </CardContent>
                </Card>
            </div>

            {/* Edit Modal */}
            {editingVault && (
                <CreateVaultModal
                    open={!!editingVault}
                    onOpenChange={(open) => !open && setEditingVault(null)}
                    vault={editingVault}
                    onSuccess={() => {
                        setEditingVault(null)
                        router.refresh()
                    }}
                />
            )}

            {/* Create Modal */}
            <CreateVaultModal
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
                onSuccess={() => {
                    router.refresh()
                }}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingVaultId} onOpenChange={() => setDeletingVaultId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this vault and all
                            associated payments.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

