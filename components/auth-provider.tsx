"use client"

import { createClient } from '@/lib/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
    loading: boolean;
    setLoading: (loading: boolean) => void;
    user: User | null;
    setUser: (user: User | null) => void;
    address: string | null;
    setAddress: (addr: string) => void;
    handleLogout: () => void;
    session: Session | null;
    setSession: (session: Session | null) => void;
    network: 'base' | 'base-sepolia';
    setNetwork: (network: 'base' | 'base-sepolia') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {

    const supabase = React.useMemo(() => createClient(), []);
    const router = useRouter();
    const pathname = usePathname();

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [network, setNetwork] = useState<'base' | 'base-sepolia'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('treasury_network');
            return (saved === 'base' || saved === 'base-sepolia') ? saved : 'base-sepolia';
        }
        return 'base-sepolia';
    });

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setAddress(null);
        router.refresh();
    }

    // Persist network to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('treasury_network', network);
        }
    }, [network]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user || null);
            setSession(session || null);
            setAddress(session?.user?.user_metadata.ethereum_address || null);
            setLoading(false);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (pathname === "/") {
                    router.push('/app');
                }
                router.refresh();
            } else if (event === 'SIGNED_OUT') {
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

    const value = React.useMemo(() => ({ 
        user, setUser, address, setAddress, handleLogout, session, setSession, loading, setLoading, network, setNetwork 
    }), [user, address, session, setUser, setAddress, setSession, handleLogout, loading, setLoading, network, setNetwork]);

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