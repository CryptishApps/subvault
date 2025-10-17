"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { EmojiPicker } from "@ferrucc-io/emoji-picker"
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
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { createVault, updateVault, type CreateVaultInput } from "@/app/app/vaults/actions"
import { toast } from "sonner"
import { handleize } from "@/lib/utils"
import { useRouter } from "next/navigation"

const vaultSchema = z.object({
    name: z.string().min(1, "Name is required"),
    handle: z.string().optional(),
    emoji: z.string().optional(),
    description: z.string().optional(),
    chain_id: z.number().int().positive(),
})

interface Vault {
    id: string
    name: string
    handle: string
    emoji: string
    description: string | null
    chain_id: number
}

interface CreateVaultModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    network?: "base" | "base-sepolia"
    vault?: Vault // If provided, modal is in edit mode
}

export function CreateVaultModal({
    open,
    onOpenChange,
    onSuccess,
    network = "base",
    vault,
}: CreateVaultModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isEditMode = !!vault
    const router = useRouter()
    // Map network to chain_id
    const chainId = network === "base" ? 8453 : 84532

    const form = useForm({
        resolver: zodResolver(vaultSchema),
        defaultValues: {
            name: vault?.name || "",
            handle: vault?.handle || "",
            emoji: vault?.emoji || "🏦",
            description: vault?.description || "",
            chain_id: vault?.chain_id || chainId,
        },
    })

    // Reset form when vault changes (for edit mode)
    useEffect(() => {
        if (vault) {
            form.reset({
                name: vault.name,
                handle: vault.handle,
                emoji: vault.emoji,
                description: vault.description || "",
                chain_id: vault.chain_id,
            })
        } else {
            form.reset({
                name: "",
                handle: "",
                emoji: "🏦",
                description: "",
                chain_id: chainId,
            })
        }
    }, [vault, chainId, form])

    // Auto-generate handle from name
    const nameValue = form.watch("name")
    useEffect(() => {
        if (!isEditMode) {
            form.setValue("handle", nameValue ? handleize(nameValue) : "")
        }
    }, [nameValue, form, isEditMode])

    async function onSubmit(values: z.infer<typeof vaultSchema>) {
        setIsSubmitting(true)
        const toastId = toast.loading(isEditMode ? "Updating vault..." : "Creating vault...")
        try {
            const result = isEditMode
                ? await updateVault(vault.id, values)
                : await createVault({
                    ...values,
                    chain_id: chainId,
                } as CreateVaultInput)

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }
            router.refresh()

            toast.success(
                isEditMode ? "Vault updated successfully!" : "Vault created successfully!",
                { id: toastId }
            )
            form.reset()
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Vault operation error:", error)
            toast.error(
                error instanceof Error
                    ? error.message
                    : `Failed to ${isEditMode ? "update" : "create"} vault`,
                {
                    id: toastId,
                }
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Edit Vault" : "Create Vault"}</DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Update your vault details."
                            : "Create a budget category vault to organize your payments and spending."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-[auto_1fr] gap-4">
                            <FormField
                                control={form.control}
                                name="emoji"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Icon</FormLabel>
                                        <FormControl>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="h-10 w-16 text-2xl p-0"
                                                        type="button"
                                                    >
                                                        {field.value || "🏦"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent 
                                                    className="w-auto p-2 max-h-[90vh]"
                                                    collisionPadding={10}
                                                >
                                                    <EmojiPicker
                                                        onEmojiSelect={(emoji: string) => {
                                                            field.onChange(emoji);
                                                        }}
                                                    >
                                                        <EmojiPicker.Header>
                                                            <EmojiPicker.Input placeholder="Search emoji" />
                                                        </EmojiPicker.Header>
                                                        <EmojiPicker.Group>
                                                            <EmojiPicker.List />
                                                        </EmojiPicker.Group>
                                                    </EmojiPicker>
                                                </PopoverContent>
                                            </Popover>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Company Treasury" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="handle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Handle</FormLabel>
                                    <FormControl>
                                        <Input {...field} readOnly className="bg-muted" />
                                    </FormControl>
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
                                            placeholder="Describe this vault..."
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
                                {isSubmitting
                                    ? isEditMode
                                        ? "Updating..."
                                        : "Creating..."
                                    : isEditMode
                                        ? "Update Vault"
                                        : "Create Vault"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

