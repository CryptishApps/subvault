"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { handleize } from "@/lib/utils"

const createVaultSchema = z.object({
    name: z.string().min(1, "Name is required").trim(),
    handle: z.string().optional(),
    emoji: z.string().optional(),
    chain_id: z.number().int().positive(),
    description: z.string().optional(),
    // Spend Permission data from requestSpendPermission
    spend_permission: z.object({
        permissionHash: z.string(),
        allowance: z.string(),
        period: z.number(),
        token: z.string(),
        signature: z.string(),
        fullPermissionData: z.any(), // Full permission object for later use
    }).optional(),
})

export type CreateVaultInput = z.infer<typeof createVaultSchema>

export async function createVault(input: CreateVaultInput) {
    try {
        const validated = createVaultSchema.parse(input)
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { data, error } = await supabase
            .from("vaults")
            .insert({
                user_id: user.id,
                name: validated.name,
                handle: handleize(validated.name),
                emoji: validated.emoji || "💼",
                chain_id: validated.chain_id,
                description: validated.description || null,
                vault_permission_hash: validated.spend_permission?.permissionHash || null,
                vault_allowance: validated.spend_permission?.allowance || null,
                vault_period_seconds: validated.spend_permission?.period || null,
                vault_token_address: validated.spend_permission?.token || null,
                vault_signature: validated.spend_permission?.signature || null,
                vault_permission_data: validated.spend_permission?.fullPermissionData || null,
            })
            .select()
            .single()

        if (error) {
            console.error("Error creating vault:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/vaults")
        return { data }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: "Failed to create vault" }
    }
}

// Store Sub Account address in user profile (called after auto-creation on connect)
export async function storeSubAccount(address: string, factory?: string, factoryData?: string) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("user_profiles")
            .update({
                sub_account_address: address,
                sub_account_factory: factory || null,
                sub_account_factory_data: factoryData || null,
            })
            .eq("user_id", user.id)

        if (error) {
            console.error("Error storing sub account:", error)
            return { error: error.message }
        }

        return { success: true }
    } catch (error) {
        return { error: "Failed to store sub account" }
    }
}

// Check if user needs onboarding
export async function checkOnboardingStatus() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { needsOnboarding: false, vaultCount: 0 }
        }

        // Fetch both profile and vault count in parallel
        const [
            { data: profile },
            { count: vaultCount }
        ] = await Promise.all([
            supabase
                .from("user_profiles")
                .select("onboarding_complete")
                .eq("user_id", user.id)
                .single(),
            supabase
                .from("vaults")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id)
        ])

        return { 
            needsOnboarding: profile ? !profile.onboarding_complete : true,
            vaultCount: vaultCount || 0
        }
    } catch (error) {
        console.error("Error checking onboarding status:", error)
        return { needsOnboarding: false, vaultCount: 0 }
    }
}

// Mark onboarding as complete
export async function completeOnboarding() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("user_profiles")
            .update({ onboarding_complete: true })
            .eq("user_id", user.id)

        if (error) {
            console.error("Error completing onboarding:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        return { success: true }
    } catch (error) {
        return { error: "Failed to complete onboarding" }
    }
}

export async function getVaults() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from("vaults")
            .select("*")
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching vaults:", error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        return { error: "Failed to fetch vaults" }
    }
}

export async function getVault(id: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from("vaults")
            .select("*")
            .eq("id", id)
            .single()

        if (error) {
            console.error("Error fetching vault:", error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        return { error: "Failed to fetch vault" }
    }
}

export async function updateVault(id: string, input: Partial<CreateVaultInput>) {
    try {
        const validated = createVaultSchema.partial().parse(input)
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { data, error } = await supabase
            .from("vaults")
            .update({
                name: validated.name,
                handle: validated.name ? handleize(validated.name) : undefined,
                emoji: validated.emoji,
                description: validated.description,
            })
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single()

        if (error) {
            console.error("Error updating vault:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/vaults")
        revalidatePath(`/app/vaults/${id}`)
        return { data }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: "Failed to update vault" }
    }
}

export async function deleteVault(id: string) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("vaults")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id)

        if (error) {
            console.error("Error deleting vault:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/vaults")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete vault" }
    }
}

// ============================================================================
// Payment Actions
// ============================================================================

export async function getPayments() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { data, error } = await supabase
            .from("payments")
            .select(`
                *,
                vault:vaults (
                    id,
                    name,
                    emoji,
                    handle
                )
            `)
            .order("next_execution_date", { ascending: true })

        if (error) {
            console.error("Error fetching payments:", error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        return { error: "Failed to fetch payments" }
    }
}

export async function deletePayment(id: string) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("payments")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("Error deleting payment:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/payments")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete payment" }
    }
}

export async function getSubAccountAddress() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { data, error } = await supabase
            .from("user_profiles")
            .select("sub_account_address")
            .eq("user_id", user.id)
            .single()

        if (error) {
            console.error("Error fetching sub account address:", error)
            return { error: error.message }
        }

        if (!data?.sub_account_address) {
            return { error: "No sub account found. Please reconnect your wallet." }
        }

        return { data: data.sub_account_address }
    } catch (error) {
        return { error: "Failed to fetch sub account address" }
    }
}

export async function updatePaymentExecutionDate(id: string, nextDate: string | null) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { error } = await supabase
            .from("payments")
            .update({ 
                next_execution_date: nextDate,
                executed_count: nextDate ? 1 : 0 // Increment if setting next date (recurring)
            })
            .eq("id", id)

        if (error) {
            console.error("Error updating payment:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/payments")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update payment" }
    }
}

const createPaymentSchema = z.object({
    vault_id: z.string().uuid("Vault is required"),
    recipient_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid recipient address"),
    recipient_name: z.string().optional(),
    amount: z.string().min(1, "Amount is required"),
    is_recurring: z.boolean().default(false),
    frequency_seconds: z.number().optional(),
    execution_mode: z.enum(["auto", "manual"]).default("auto"),
    description: z.string().optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export async function createPayment(input: CreatePaymentInput) {
    try {
        const validated = createPaymentSchema.parse(input)
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        // Verify the vault belongs to the user
        const { data: vault } = await supabase
            .from("vaults")
            .select("id")
            .eq("id", validated.vault_id)
            .single()

        if (!vault) {
            return { error: "Vault not found" }
        }

        // Convert amount from USDC (e.g., 100) to smallest unit (e.g., 100000000)
        const amountInSmallestUnit = (parseFloat(validated.amount) * 1_000_000).toString()

        // Calculate next execution date
        const nextExecutionDate = new Date()
        if (validated.is_recurring && validated.frequency_seconds) {
            nextExecutionDate.setSeconds(nextExecutionDate.getSeconds() + validated.frequency_seconds)
        }

        const { data, error } = await supabase
            .from("payments")
            .insert({
                vault_id: validated.vault_id,
                recipient_address: validated.recipient_address,
                recipient_name: validated.recipient_name || null,
                amount: amountInSmallestUnit,
                is_recurring: validated.is_recurring,
                frequency_seconds: validated.frequency_seconds || null,
                next_execution_date: nextExecutionDate.toISOString(),
                execution_mode: validated.execution_mode,
                description: validated.description || null,
                status: 'active',
            })
            .select()
            .single()

        if (error) {
            console.error("Error creating payment:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/vaults")
        revalidatePath(`/app/vaults/${validated.vault_id}`)
        return { data }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: "Failed to create payment" }
    }
}

