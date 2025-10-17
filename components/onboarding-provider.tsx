"use client"

import { createContext, useContext, useState, ReactNode } from "react"

type OnboardingStep = "sub-account" | "create-vault" | "create-payment" | "complete"

interface OnboardingContextType {
    currentStep: OnboardingStep
    setCurrentStep: (step: OnboardingStep) => void
    isOnboarding: boolean
    setIsOnboarding: (value: boolean) => void
    completeStep: (step: OnboardingStep) => void
    completedSteps: Set<OnboardingStep>
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("create-vault")
    const [isOnboarding, setIsOnboarding] = useState(false)
    const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(
        new Set(["sub-account"]) // Sub account is pre-completed during login
    )

    const completeStep = (step: OnboardingStep) => {
        setCompletedSteps(prev => new Set([...prev, step]))

        // Move to next step
        const stepOrder: OnboardingStep[] = ["sub-account", "create-vault", "create-payment", "complete"]
        const currentIndex = stepOrder.indexOf(step)
        if (currentIndex < stepOrder.length - 1) {
            setCurrentStep(stepOrder[currentIndex + 1])
        }
    }

    return (
        <OnboardingContext.Provider
            value={{
                currentStep,
                setCurrentStep,
                isOnboarding,
                setIsOnboarding,
                completeStep,
                completedSteps,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    )
}

export function useOnboarding() {
    const context = useContext(OnboardingContext)
    if (context === undefined) {
        throw new Error("useOnboarding must be used within OnboardingProvider")
    }
    return context
}

