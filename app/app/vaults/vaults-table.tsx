"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
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
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateVaultModal } from "@/components/modals/create-vault"
import { deleteVault } from "./actions"
import { toast } from "sonner"
import { formatDistance } from "date-fns"

interface Vault {
    id: string
    name: string
    handle: string
    emoji: string
    description: string | null
    chain_id: number
    created_at: string
    updated_at: string
}

interface VaultsTableProps {
    initialVaults: Vault[]
}

const ITEMS_PER_PAGE = 10

export function VaultsTable({ initialVaults }: VaultsTableProps) {
    const [vaults, setVaults] = useState<Vault[]>(initialVaults)
    const [currentPage, setCurrentPage] = useState(1)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingVault, setEditingVault] = useState<Vault | undefined>()
    const [deletingVaultId, setDeletingVaultId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Calculate pagination
    const totalPages = Math.ceil(vaults.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const currentVaults = vaults.slice(startIndex, endIndex)

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = []
        const showEllipsis = totalPages > 7

        if (!showEllipsis) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }

        // Always show first page
        pages.push(1)

        if (currentPage > 3) {
            pages.push("ellipsis")
        }

        // Show pages around current page
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push(i)
        }

        if (currentPage < totalPages - 2) {
            pages.push("ellipsis")
        }

        // Always show last page
        if (totalPages > 1) {
            pages.push(totalPages)
        }

        return pages
    }

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
            setVaults((prev) => prev.filter((v) => v.id !== deletingVaultId))
            setDeletingVaultId(null)

            // Adjust current page if needed
            const newTotalPages = Math.ceil((vaults.length - 1) / ITEMS_PER_PAGE)
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages)
            }
        } catch (error) {
            toast.error("Failed to delete vault", { id: toastId })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleSuccess = () => {
        // Refresh the page to get updated data
        window.location.reload()
    }

    const getChainName = (chainId: number) => {
        return chainId === 8453 ? "Base" : "Base Sepolia"
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Vault
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">Icon</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Handle</TableHead>
                            <TableHead>Chain</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-[70px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentVaults.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No vaults found.{" "}
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="text-primary hover:underline"
                                    >
                                        Create your first vault
                                    </button>
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentVaults.map((vault) => (
                                <TableRow key={vault.id}>
                                    <TableCell>
                                        <span className="text-2xl">{vault.emoji}</span>
                                    </TableCell>
                                    <TableCell className="font-medium">{vault.name}</TableCell>
                                    <TableCell>
                                        <code className="text-xs text-muted-foreground">
                                            {vault.handle}
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{getChainName(vault.chain_id)}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {vault.description || "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDistance(new Date(vault.created_at), new Date(), {
                                                addSuffix: true,
                                            })}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Open menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setEditingVault(vault)
                                                        setShowCreateModal(true)
                                                    }}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setDeletingVaultId(vault.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                className={
                                    currentPage === 1
                                        ? "pointer-events-none opacity-50"
                                        : "cursor-pointer"
                                }
                            />
                        </PaginationItem>

                        {getPageNumbers().map((page, index) =>
                            page === "ellipsis" ? (
                                <PaginationItem key={`ellipsis-${index}`}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        onClick={() => setCurrentPage(page)}
                                        isActive={currentPage === page}
                                        className="cursor-pointer"
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            )
                        )}

                        <PaginationItem>
                            <PaginationNext
                                onClick={() =>
                                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                                }
                                className={
                                    currentPage === totalPages
                                        ? "pointer-events-none opacity-50"
                                        : "cursor-pointer"
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

            <CreateVaultModal
                open={showCreateModal}
                onOpenChange={(open) => {
                    setShowCreateModal(open)
                    if (!open) setEditingVault(undefined)
                }}
                onSuccess={handleSuccess}
                network="base"
                vault={editingVault}
            />

            <AlertDialog open={!!deletingVaultId} onOpenChange={() => setDeletingVaultId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the vault and
                            all associated payments.
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
        </div>
    )
}

