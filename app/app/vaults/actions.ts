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

export async function getVaultsWithStats() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        // Fetch vaults and their stats in parallel
        const [vaultsResult, statsResult] = await Promise.all([
            supabase
                .from("vaults")
                .select("*")
                .order("created_at", { ascending: false }),
            supabase
                .from("vault_spending_summary")
                .select("*")
        ])

        if (vaultsResult.error) {
            console.error("Error fetching vaults:", vaultsResult.error)
            return { error: vaultsResult.error.message }
        }

        if (statsResult.error) {
            console.error("Error fetching stats:", statsResult.error)
            return { error: statsResult.error.message }
        }

        // Merge the stats with vault data
        const vaultsWithStats = vaultsResult.data.map(vault => {
            const stats = statsResult.data?.find(s => s.vault_id === vault.id) || {
                total_payments: 0,
                active_payments: 0,
                completed_payments: 0,
                total_spent: 0
            }
            return {
                ...vault,
                stats
            }
        })

        return { data: vaultsWithStats }
    } catch (error) {
        return { error: "Failed to fetch vaults with stats" }
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

export async function getVaultByHandle(handle: string) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        const { data, error } = await supabase
            .from("vaults")
            .select("*")
            .eq("handle", handle)
            .eq("user_id", user.id)
            .single()

        if (error) {
            console.error("Error fetching vault by handle:", error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        return { error: "Failed to fetch vault" }
    }
}

export async function getVaultPayments(vaultId: string) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized", data: [] }
        }

        // First verify the vault belongs to the user
        const { data: vault } = await supabase
            .from("vaults")
            .select("id")
            .eq("id", vaultId)
            .eq("user_id", user.id)
            .single()

        if (!vault) {
            return { error: "Vault not found", data: [] }
        }

        const { data, error } = await supabase
            .from("payments")
            .select("*")
            .eq("vault_id", vaultId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching vault payments:", error)
            return { error: error.message, data: [] }
        }

        return { data: data || [] }
    } catch (error) {
        console.error("Failed to fetch vault payments:", error)
        return { error: "Failed to fetch vault payments", data: [] }
    }
}

export async function getPaymentsOverTime(vaultId?: string, days: number = 30) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .rpc('get_payments_over_time', {
                p_vault_id: vaultId || null,
                p_days: days
            })

        if (error) {
            console.error("Error fetching payments over time:", error)
            return { error: error.message, data: [] }
        }

        return { data: data || [] }
    } catch (error) {
        console.error("Failed to fetch payments over time:", error)
        return { error: "Failed to fetch payments over time", data: [] }
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

export async function getPayments(filters?: {
    dateFilter?: 'overdue' | 'upcoming' | 'all'
    status?: string
}) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: "Unauthorized" }
        }

        let query = supabase
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

        // Apply filters
        if (filters?.status) {
            query = query.eq("status", filters.status)
        }

        // Date-based filtering
        if (filters?.dateFilter === 'overdue') {
            const now = new Date().toISOString()
            query = query.lt("next_execution_date", now)
        } else if (filters?.dateFilter === 'upcoming') {
            const now = new Date().toISOString()
            query = query.gte("next_execution_date", now)
        }

        query = query.order("next_execution_date", { ascending: true })

        const { data, error } = await query

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

export async function storePaymentTransaction(id: string, txHash: string) {
    try {
        const supabase = await createClient()

        // Get existing transaction hashes
        const { data: payment, error: fetchError } = await supabase
            .from("payments")
            .select("transaction_hashes")
            .eq("id", id)
            .single()

        if (fetchError) {
            console.error("Error fetching payment:", fetchError)
            return { error: fetchError.message }
        }

        // Append new transaction hash
        const existingHashes = (payment.transaction_hashes as string[]) || []
        const updatedHashes = [...existingHashes, txHash]

        // Get current executed_count
        const { data: currentPayment } = await supabase
            .from("payments")
            .select("executed_count")
            .eq("id", id)
            .single()

        const { error } = await supabase
            .from("payments")
            .update({
                transaction_hashes: updatedHashes,
                last_payment_date: new Date().toISOString(),
                executed_count: (currentPayment?.executed_count || 0) + 1
            })
            .eq("id", id)

        if (error) {
            console.error("Error storing transaction:", error)
            return { error: error.message }
        }

        return { success: true }
    } catch (error) {
        return { error: "Failed to store transaction" }
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
                status: nextDate ? 'active' : 'completed',
                executed_count: nextDate ? 1 : 1 // Set to 1 when payment is executed
            })
            .eq("id", id)

        if (error) {
            console.error("Error updating payment:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/payments")
        revalidatePath("/app/payments/history")
        revalidatePath("/app/payments/overdue")
        revalidatePath("/app/payments/upcoming")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update payment" }
    }
}

const createPaymentSeriesSchema = z.object({
    vault_id: z.string().uuid("Vault is required"),
    recipient_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid recipient address"),
    recipient_name: z.string().optional(),
    amount: z.string().min(1, "Amount is required"),
    start_date: z.date(),
    frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
    number_of_payments: z.number().min(1).max(100),
    description: z.string().optional(),
    chain: z.enum(["base", "base-sepolia"]),
})

export type CreatePaymentSeriesInput = z.infer<typeof createPaymentSeriesSchema>

export async function createPaymentSeries(input: CreatePaymentSeriesInput) {
    try {
        const validated = createPaymentSeriesSchema.parse(input)
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

        // Generate a series ID to group payments created together
        const seriesId = crypto.randomUUID()

        // Calculate dates for all payments
        const payments = []
        const numberOfPayments = validated.frequency === "none" ? 1 : validated.number_of_payments

        for (let i = 0; i < numberOfPayments; i++) {
            const paymentDate = new Date(validated.start_date)

            if (validated.frequency === "daily") {
                paymentDate.setDate(paymentDate.getDate() + i)
            } else if (validated.frequency === "weekly") {
                paymentDate.setDate(paymentDate.getDate() + (i * 7))
            } else if (validated.frequency === "monthly") {
                paymentDate.setMonth(paymentDate.getMonth() + i)
            } else if (validated.frequency === "yearly") {
                paymentDate.setFullYear(paymentDate.getFullYear() + i)
            }
            // For "none", paymentDate stays as start_date

            payments.push({
                vault_id: validated.vault_id,
                recipient_address: validated.recipient_address,
                recipient_name: validated.recipient_name || null,
                amount: amountInSmallestUnit,
                next_execution_date: paymentDate.toISOString(),
                description: validated.description || null,
                status: 'active',
                series_id: numberOfPayments > 1 ? seriesId : null,
                chain: validated.chain,
            })
        }

        const { data, error } = await supabase
            .from("payments")
            .insert(payments)
            .select()

        if (error) {
            console.error("Error creating payments:", error)
            return { error: error.message }
        }

        revalidatePath("/app")
        revalidatePath("/app/vaults")
        revalidatePath("/app/payments")
        revalidatePath(`/app/vaults/${validated.vault_id}`)
        return { data }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0].message }
        }
        return { error: "Failed to create payments" }
    }
}

