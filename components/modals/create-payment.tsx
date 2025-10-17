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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { createPaymentSeries, getVaults } from "@/app/app/vaults/actions"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"

const paymentSchema = z.object({
    vault_id: z.string().uuid("Please select a vault"),
    recipient_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
    recipient_name: z.string().optional(),
    amount: z.string().min(1, "Amount is required"),
    start_date: z.date(),
    frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
    number_of_payments: z.number().min(1, "Must be at least 1").max(100, "Maximum 100 payments").default(1),
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
    const { network } = useAuth()
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
            start_date: new Date(),
            frequency: "none" as const,
            number_of_payments: 1,
            description: "",
        },
    })

    const frequency = form.watch("frequency")
    const numberOfPayments = form.watch("number_of_payments")

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

    // Reset number_of_payments to 1 when frequency is "none"
    useEffect(() => {
        if (frequency === "none") {
            form.setValue("number_of_payments", 1)
        }
    }, [frequency, form])

    async function onSubmit(values: z.infer<typeof paymentSchema>) {
        setIsSubmitting(true)
        const numPayments = values.frequency === "none" ? 1 : values.number_of_payments
        const toastId = toast.loading(
            numPayments === 1 
                ? "Creating payment..." 
                : `Creating ${numPayments} payments...`
        )
        
        try {
            const result = await createPaymentSeries({
                ...values,
                chain: network,
            })

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }

            toast.success(
                numPayments === 1 
                    ? "Payment created successfully!" 
                    : `${numPayments} payments created successfully!`,
                { id: toastId }
            )
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
                    <DialogTitle>Create Payment{(numberOfPayments || 1) > 1 && "s"}</DialogTitle>
                    <DialogDescription>
                        Schedule a single payment or create multiple payments at once.
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
                                        <Input
                                            placeholder="0x..."
                                            {...field}
                                        />
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
                                    <FormLabel>Recipient Name (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Freelancer, Service Provider"
                                            {...field}
                                        />
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
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="100.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Amount in USDC per payment
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="start_date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Start Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date < new Date(new Date().setHours(0, 0, 0, 0))
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormDescription>
                                        Date of the first payment
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select frequency..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">One-time only</SelectItem>
                                                <SelectItem value="daily">Daily</SelectItem>
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormDescription>
                                        How often to schedule payments
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {frequency !== "none" && (
                            <FormField
                                control={form.control}
                                name="number_of_payments"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Number of Payments</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={100}
                                                placeholder="12"
                                                {...field}
                                                value={field.value}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Total number of payments to create (1-100)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add notes about this payment..."
                                            className="resize-none"
                                            {...field}
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
                                {isSubmitting 
                                    ? "Creating..." 
                                    : (numberOfPayments || 1) > 1 
                                        ? `Create ${numberOfPayments || 1} Payments`
                                        : "Create Payment"
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
