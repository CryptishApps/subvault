import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { OnboardingProvider } from "@/components/onboarding-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <OnboardingProvider>
            <SidebarProvider
                className="flex"
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 64)",
                        "--header-height": "calc(var(--spacing) * 12 + 1px)",
                    } as React.CSSProperties
                }
            >
                <AppSidebar variant="sidebar" />
                <SidebarInset>
                    <SiteHeader />
                    <div className="flex flex-1 flex-col">
                        <div className="@container/main flex flex-1 flex-col gap-2">
                            {children}
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </OnboardingProvider>
    )
}