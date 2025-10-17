"use client"

import { useEffect, useRef } from "react"
import { OnboardingModal } from "@/components/modals/onboarding-modal"
import { useOnboarding } from "@/components/onboarding-provider"

interface OnboardingClientProps {
  needsOnboarding: boolean
  vaultCount: number
  hasSubAccount: boolean
  network: "base" | "base-sepolia"
}

export function OnboardingClient({ needsOnboarding, vaultCount, hasSubAccount, network }: OnboardingClientProps) {
  const { setIsOnboarding, completeStep } = useOnboarding()
  const initialized = useRef(false)

  useEffect(() => {
    // Only run once on mount
    if (!initialized.current && needsOnboarding) {
      initialized.current = true
      setIsOnboarding(true)
      
      // Pre-complete the sub account step if they already have one
      if (hasSubAccount) {
        completeStep("sub-account")
      }
      
      // Pre-tick the vault creation step if they have at least one vault
      if (vaultCount > 0) {
        completeStep("create-vault")
      }
    }
  }, [needsOnboarding, vaultCount, hasSubAccount])

  return <OnboardingModal network={network} />
}

