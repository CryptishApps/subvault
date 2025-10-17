"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function PaymentsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                <p className="text-muted-foreground">
                    Manage your scheduled and completed payments
                </p>
            </div>

            <PaymentsNav />

            {children}
        </div>
    )
}

function PaymentsNav() {
    const pathname = usePathname()

    const links = [
        { href: "/app/payments/overdue", label: "Overdue" },
        { href: "/app/payments/upcoming", label: "Upcoming" },
        { href: "/app/payments/history", label: "History" },
    ]

    return (
        <nav className="flex gap-4 border-b">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                        "pb-3 px-1 border-b-2 transition-colors text-sm font-medium",
                        pathname === link.href
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {link.label}
                </Link>
            ))}
        </nav>
    )
}

