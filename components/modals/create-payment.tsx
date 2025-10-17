"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { createPayment, type CreatePaymentInput, getVaults } from "@/app/app/vaults/actions"
import { toast } from "sonner"

const paymentSchema = z.object({
    vault_id: z.string().uuid("Please select a vault"),
    recipient_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
    recipient_name: z.string().optional(),
    amount: z.string().min(1, "Amount is required"),
    is_recurring: z.boolean().default(false),
    frequency_seconds: z.number().optional(),
    execution_mode: z.enum(["auto", "manual"]).default("auto"),
    description: z.string().optional(),
})

interface CreatePaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    preselectedVaultId?: string
}

interface Vault {
    id: string
    name: string
    emoji: string
}

export function CreatePaymentModal({
    open,
    onOpenChange,
    onSuccess,
    preselectedVaultId,
}: CreatePaymentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [vaults, setVaults] = useState<Vault[]>([])
    const [isLoadingVaults, setIsLoadingVaults] = useState(true)

    const form = useForm({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            vault_id: preselectedVaultId || "",
            recipient_address: "",
            recipient_name: "",
            amount: "",
            is_recurring: false,
            frequency_seconds: undefined,
            execution_mode: "auto" as const,
            description: "",
        },
    })

    const isRecurring = form.watch("is_recurring")

    async function loadVaults() {
        setIsLoadingVaults(true)
        try {
            const result = await getVaults()
            if (result.error) {
                toast.error(result.error)
                return
            }
            setVaults(result.data || [])
        } catch (error) {
            toast.error("Failed to load vaults")
        } finally {
            setIsLoadingVaults(false)
        }
    }

    useEffect(() => {
        if (open) {
            loadVaults()
        }
    }, [open])

    useEffect(() => {
        if (preselectedVaultId) {
            form.setValue("vault_id", preselectedVaultId)
        }
    }, [preselectedVaultId, form])

    async function onSubmit(values: z.infer<typeof paymentSchema>) {
        setIsSubmitting(true)
        const toastId = toast.loading("Creating payment...")
        
        try {
            const result = await createPayment({
                ...values,
                frequency_seconds: values.is_recurring ? values.frequency_seconds : undefined,
            } as CreatePaymentInput)

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }

            toast.success("Payment created successfully!", { id: toastId })
            form.reset()
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Payment creation error:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create payment", {
                id: toastId,
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto theme-container">
                <DialogHeader>
                    <DialogTitle>Create Payment</DialogTitle>
                    <DialogDescription>
                        Set up a one-time or recurring payment. No additional signatures needed!
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="vault_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vault</FormLabel>
                                    <FormControl>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={isLoadingVaults || !!preselectedVaultId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a vault..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vaults.length === 0 ? (
                                                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                                        No vaults found
                                                    </div>
                                                ) : (
                                                    vaults.map((vault) => (
                                                        <SelectItem key={vault.id} value={vault.id}>
                                                            <span className="flex items-center gap-2">
                                                                <span>{vault.emoji}</span>
                                                                <span>{vault.name}</span>
                                                            </span>
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="recipient_address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="0x..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="recipient_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient Name (optional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g., Designer, Tool Subscription" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount (USDC)</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="number" step="0.01" placeholder="100.00" />
                                    </FormControl>
                                    <FormDescription>
                                        Enter the amount in USDC (e.g., 100 for $100)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_recurring"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">
                                            Recurring Payment
                                        </FormLabel>
                                        <FormDescription>
                                            Automatically execute this payment on a schedule
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {isRecurring && (
                            <FormField
                                control={form.control}
                                name="frequency_seconds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Frequency</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value?.toString()}
                                                onValueChange={(val) => field.onChange(parseInt(val))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select frequency..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="86400">Daily</SelectItem>
                                                    <SelectItem value="604800">Weekly</SelectItem>
                                                    <SelectItem value="2592000">Monthly (30 days)</SelectItem>
                                                    <SelectItem value="7776000">Quarterly (90 days)</SelectItem>
                                                    <SelectItem value="31536000">Yearly (365 days)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="execution_mode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Execution Mode</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">
                                                    Automatic - Execute automatically when due
                                                </SelectItem>
                                                <SelectItem value="manual">
                                                    Manual - You click to pay when ready
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormDescription>
                                        With Sub Accounts, no signature needed either way!
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            placeholder="Add any notes about this payment..."
                                            className="resize-none"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Payment"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

