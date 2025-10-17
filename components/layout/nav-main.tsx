"use client"

import { IconCircleKey, IconLocationDollar } from "@tabler/icons-react"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboard } from "lucide-react"
import Link from "next/link"

const items = [
    {
        title: "Dashboard",
        url: "/app",
        icon: LayoutDashboard,
    },
    {
        title: "Vaults",
        url: "/app/vaults",
        icon: IconCircleKey,
    },
    {
        title: "Payments",
        url: "/app/payments/overdue",
        icon: IconLocationDollar,
    }
]

export function NavMain() {
    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarGroupLabel>Home</SidebarGroupLabel>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton tooltip={item.title} asChild>
                                <Link href={item.url}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}