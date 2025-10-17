"use client"

import {
    IconDotsVertical,
    IconLogout,
    IconSwitch,
} from "@tabler/icons-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { formatAddress } from "@/lib/utils"
import { UserAvatar } from "../user-avatar"
import { useCallback } from "react"
import { toast } from "sonner"

export function NavUser() {
    const { isMobile } = useSidebar()
    const { address, handleLogout, network, setNetwork } = useAuth()

    const formattedAddress = formatAddress(address || '')

    const handleSwitchNetwork = useCallback(() => {
        setNetwork(network === 'base' ? 'base-sepolia' : 'base');
        toast.success(`Switched to ${network === 'base' ? 'Base Sepolia' : 'Base'} network`)
    }, [network, setNetwork])

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <UserAvatar className="h-8 w-8 rounded-lg" address={address || ''} />
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{formattedAddress}</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    {formattedAddress}
                                </span>
                            </div>
                            <IconDotsVertical className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <UserAvatar className="h-8 w-8 rounded-lg" address={address || ''} />
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{formattedAddress}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {formattedAddress}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={handleSwitchNetwork}>
                                <IconSwitch />
                                Switch to {network === 'base' ? 'Base Sepolia' : 'Base'}
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem>
                                <IconCreditCard />
                                Billing
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <IconNotification />
                                Notifications
                            </DropdownMenuItem> */}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <IconLogout />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}