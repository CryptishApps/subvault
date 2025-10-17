"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import { CreateVaultModal } from "@/components/modals/create-vault"
import { useAuth } from "@/components/auth-provider"
import { IconCircleKey } from "@tabler/icons-react"

interface VaultStatCardProps {
    count: number
}

export function VaultStatCard({ count }: VaultStatCardProps) {
    const [showModal, setShowModal] = useState(false)
    const router = useRouter()
    const { network } = useAuth()

    return (
        <>
            <Empty className="h-full border bg-card !py-6">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <IconCircleKey />
                    </EmptyMedia>
                    <EmptyTitle>
                        {count === 0 ? "No Vaults" : `${count} ${count === 1 ? "Vault" : "Vaults"}`}
                    </EmptyTitle>
                    <EmptyDescription className="leading-tight">
                        {count === 0
                            ? "Create your first vault to start managing funds."
                            : "SubVault accounts managing your funds."
                        }
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button
                        size="sm"
                        variant={count === 0 ? "default" : "outline"}
                        onClick={() => setShowModal(true)}
                    >
                        {count === 0 ? "Create Vault" : "New Vault"}
                    </Button>
                </EmptyContent>
            </Empty>

            <CreateVaultModal
                open={showModal}
                onOpenChange={setShowModal}
                onSuccess={() => router.refresh()}
                network={network}
            />
        </>
    )
}

