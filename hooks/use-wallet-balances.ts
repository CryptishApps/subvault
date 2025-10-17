"use client"

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { createPublicClient, http, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// USDC contract addresses on Base networks
const USDC_CONTRACTS = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

// Chain configurations
const CHAINS = {
    'base': base,
    'base-sepolia': baseSepolia,
} as const;

interface WalletBalances {
    eth: string;
    usdc: string;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to fetch ETH and USDC balances for the current user's Base wallet
 * Uses Base Account SDK provider to make RPC calls
 */
export function useWalletBalances(): WalletBalances {
    const { address, network } = useAuth();
    const [balances, setBalances] = useState<WalletBalances>({
        eth: '0',
        usdc: '0',
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!address) {
            setBalances({
                eth: '0',
                usdc: '0',
                loading: false,
                error: null,
            });
            return;
        }

        let isMounted = true;

        async function fetchBalances() {
            try {
                // Capture address at the start to satisfy TypeScript
                const currentAddress = address;
                if (!currentAddress) return;

                setBalances(prev => ({ ...prev, loading: true, error: null }));

                // Create a public client for the specific chain we want to query
                const chain = CHAINS[network];
                const publicClient = createPublicClient({
                    chain,
                    transport: http(),
                });

                const usdcContractAddress = USDC_CONTRACTS[network];

                // Fetch both balances in parallel using the chain-specific public client
                const [ethBalance, usdcBalance] = await Promise.all([
                    // Fetch ETH balance
                    publicClient.getBalance({
                        address: currentAddress as `0x${string}`,
                    }),
                    // Fetch USDC balance - call balanceOf(address) function
                    publicClient.readContract({
                        address: usdcContractAddress as `0x${string}`,
                        abi: [{
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ type: 'uint256' }],
                        }],
                        functionName: 'balanceOf',
                        args: [currentAddress as `0x${string}`],
                    }) as Promise<bigint>,
                ]);

                // Format balances
                const ethBalanceFormatted = formatUnits(ethBalance, 18);
                const usdcBalanceFormatted = formatUnits(usdcBalance, 6);

                if (isMounted) {
                    setBalances({
                        eth: parseFloat(ethBalanceFormatted).toFixed(4),
                        usdc: parseFloat(usdcBalanceFormatted).toFixed(2),
                        loading: false,
                        error: null,
                    });
                }
            } catch (error) {
                console.error('Error fetching balances:', error);
                if (isMounted) {
                    setBalances({
                        eth: '0',
                        usdc: '0',
                        loading: false,
                        error: error instanceof Error ? error.message : 'Failed to fetch balances',
                    });
                }
            }
        }

        fetchBalances();

        // Poll for balance updates every 60 seconds
        const interval = setInterval(fetchBalances, 60000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [address, network]);

    return balances;
}

