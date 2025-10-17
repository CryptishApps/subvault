"use client"

import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export function UserAvatar({ className, address }: { className: string, address: string }) {

    const avatar = createAvatar(bottts, {
        seed: address,
    });

    const dataUri = avatar.toDataUri();
    return (
        <Avatar className={className}>
            <AvatarImage src={dataUri} />
            <AvatarFallback className="rounded-lg">{address.slice(0, 2)}</AvatarFallback>
        </Avatar>
    )
}