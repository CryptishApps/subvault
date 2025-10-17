"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { CreateVaultModal } from "./create-vault"
import { CreatePaymentModal } from "./create-payment"
import { useOnboarding } from "../onboarding-provider"
import { completeOnboarding, getVaults } from "@/app/app/vaults/actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { IconCircleKey } from "@tabler/icons-react"

interface OnboardingModalProps {
    network: "base" | "base-sepolia"
}

export function OnboardingModal({ network }: OnboardingModalProps) {
    const router = useRouter()
    const { currentStep, isOnboarding, setIsOnboarding, completeStep, completedSteps } = useOnboarding()
    const [showVaultModal, setShowVaultModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [firstVaultId, setFirstVaultId] = useState<string | undefined>()
    const [isCompleting, setIsCompleting] = useState(false)

    const handleVaultCreated = async () => {
        setShowVaultModal(false)
        completeStep("create-vault")
        
        // Load the first vault to pre-select for payment creation
        try {
            const result = await getVaults()
            if (result.data && result.data.length > 0) {
                setFirstVaultId(result.data[0].id)
            }
        } catch (error) {
            console.error("Failed to load vault:", error)
        }
    }

    const handlePaymentCreated = () => {
        setShowPaymentModal(false)
        completeStep("create-payment")
    }

    const handleComplete = async () => {
        setIsCompleting(true)
        try {
            const result = await completeOnboarding()
            if (result.error) {
                toast.error(result.error)
                return
            }

            setIsOnboarding(false)
            router.refresh()
            toast.success("Welcome to SubVault!")
        } catch (error) {
            toast.error("Failed to complete onboarding")
        } finally {
            setIsCompleting(false)
        }
    }

    const steps = [
        { id: "sub-account", label: "Create Sub Account", completed: completedSteps.has("sub-account") },
        { id: "create-vault", label: "Create Your First Vault", completed: completedSteps.has("create-vault") },
        { id: "create-payment", label: "Set Up a Payment", completed: completedSteps.has("create-payment") },
    ]

    return (
        <>
             <Dialog open={isOnboarding} onOpenChange={() => { }} modal={true}>
                 <DialogContent
                     className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button]:hidden bg-background text-foreground theme-container"
                     onPointerDownOutside={(e) => e.preventDefault()}
                     onEscapeKeyDown={(e) => e.preventDefault()}
                 >
                    <DialogHeader>
                        <DialogTitle>Welcome to SubVault</DialogTitle>
                        <DialogDescription>
                            Let's set up your account in a few quick steps
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center py-4">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center justify-center">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors", step.completed
                                            ? "bg-primary border-primary text-primary-foreground"
                                            : currentStep === step.id
                                                ? "border-primary text-primary"
                                                : "border-muted-foreground/30 text-muted-foreground"
                                            )}
                                    >
                                        {step.completed ? <Check className="h-5 w-5" /> : index + 1}
                                    </div>
                                    <span className="text-xs mt-2 text-center max-w-[80px]">{step.label}</span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={`h-0.5 w-20 mx-2 transition-colors ${steps[index + 1].completed ? "bg-primary" : "bg-muted"
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step Content */}
                    <div className="min-h-[300px]">
                        {currentStep === "create-vault" && (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <IconCircleKey />
                                    </EmptyMedia>
                                    <EmptyTitle>Create Your First Vault</EmptyTitle>
                                    <EmptyDescription>
                                        Vaults are budget categories that help you organize payments. For example, you might create vaults for "Marketing", "Development", or "Operations".
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={() => setShowVaultModal(true)} size="lg">
                                        Create Vault
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        )}

                        {currentStep === "create-payment" && (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                                        </svg>
                                    </EmptyMedia>
                                    <EmptyTitle>Set Up Your First Payment</EmptyTitle>
                                    <EmptyDescription>
                                        Payments can be one-time or recurring. With Sub Accounts, these execute automatically without signatures.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <div className="flex flex-col gap-2 w-full max-w-sm">
                                        <Button onClick={() => setShowPaymentModal(true)} size="lg">
                                            Create Payment
                                        </Button>
                                        <Button onClick={handlePaymentCreated} variant="outline" size="lg">
                                            Skip for Now
                                        </Button>
                                    </div>
                                </EmptyContent>
                            </Empty>
                        )}

                        {currentStep === "complete" && (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                        </svg>
                                    </EmptyMedia>
                                    <EmptyTitle>You're All Set!</EmptyTitle>
                                    <EmptyDescription className="text-wrap">
                                        Your SubVault account is ready. You can now create more vaults, set up payments, and manage your treasury.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <div className="flex flex-col gap-2 w-full text-left">
                                        <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                                            <div className="flex items-start gap-3">
                                                <Check className="h-5 w-5 text-primary mt-0.5" />
                                                <div>
                                                    <p className="font-medium">Sub Account Created</p>
                                                    <p className="text-muted-foreground text-xs">Your transactions will use your Base Account balance automatically</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Check className="h-5 w-5 text-primary mt-0.5" />
                                                <div>
                                                    <p className="font-medium">First Vault Created</p>
                                                    <p className="text-muted-foreground text-xs">Organize payments into budget categories</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Button onClick={handleComplete} size="lg" disabled={isCompleting}>
                                            {isCompleting ? "Finishing..." : "Get Started"}
                                        </Button>
                                    </div>
                                </EmptyContent>
                            </Empty>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <CreateVaultModal
                open={showVaultModal}
                onOpenChange={setShowVaultModal}
                onSuccess={handleVaultCreated}
                network={network}
            />

            <CreatePaymentModal
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                onSuccess={handlePaymentCreated}
                preselectedVaultId={firstVaultId}
            />
        </>
    )
}

