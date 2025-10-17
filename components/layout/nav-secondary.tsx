"use client"

import * as React from "react"
import { IconPalette, IconMoon, IconSun } from "@tabler/icons-react"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useTheme } from "next-themes"

export function NavSecondary({
    ...props
}: React.ComponentProps<typeof SidebarGroup>) {

    const { theme, setTheme } = useTheme()

    const handleThemeToggle = () => {
        setTheme(theme === "light" ? "dark" : "light")
    }
    return (
        <SidebarGroup {...props}>
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={handleThemeToggle}>
                            {theme === "light" ? <IconSun /> : <IconMoon />}
                            <span>Theme</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}