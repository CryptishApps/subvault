"use client"

import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    address: string | null;
    setAddress: (addr: string) => void;
    handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {

    const supabase = React.useMemo(() => createClient(), []);
    const router = useRouter();
    const pathname = usePathname();

    const [user, setUser] = useState<User | null>(null);
    const [address, setAddress] = useState<string | null>(null);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
    }

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user || null);
            setAddress(session?.user?.user_metadata.ethereum_address || null);
            if (event === 'SIGNED_IN') {
                console.log('Signed in');
                if (pathname === "/") {
                    router.push('/app');
                }
                router.refresh();
            } else if (event === 'SIGNED_OUT') {
                console.log('Signed out');
                if (pathname !== "/") {
                    router.push('/');
                }
                router.refresh();
            } else if (session?.user && pathname === "/") {
                router.push('/app');
            }
        });
        return () => subscription.unsubscribe();
    }, [pathname]);

    const value = React.useMemo(() => ({ user, setUser, address, setAddress, handleLogout }), [user, address]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};