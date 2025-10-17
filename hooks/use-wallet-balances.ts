"use client"

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { createBaseAccountSDK } from '@base-org/account';
import { formatUnits } from 'viem';

// USDC contract addresses on Base networks
const USDC_CONTRACTS = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
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

                const sdk = createBaseAccountSDK({
                    appName: 'SubVault',
                    appLogoUrl: 'https://base.org/logo.png',
                });
                const provider = sdk.getProvider();

                // Prepare USDC balance call data
                const usdcContractAddress = USDC_CONTRACTS[network];
                const addressWithoutPrefix = currentAddress.startsWith('0x') ? currentAddress.slice(2) : currentAddress;
                const paddedAddress = addressWithoutPrefix.padStart(64, '0');
                const data = `0x70a08231${paddedAddress}`;

                // Fetch both balances in parallel using Promise.all
                const [ethBalanceHex, usdcBalanceHex] = await Promise.all([
                    // Fetch ETH balance using eth_getBalance
                    provider.request({
                        method: 'eth_getBalance',
                        params: [currentAddress, 'latest'],
                    }) as Promise<string>,
                    // Fetch USDC balance using eth_call
                    // Call balanceOf(address) function - function selector: 0x70a08231
                    provider.request({
                        method: 'eth_call',
                        params: [
                            {
                                to: usdcContractAddress,
                                data,
                            },
                            'latest',
                        ],
                    }) as Promise<string>,
                ]);

                // Format balances
                const ethBalance = formatUnits(BigInt(ethBalanceHex), 18);
                const usdcBalance = formatUnits(BigInt(usdcBalanceHex), 6); // USDC has 6 decimals

                if (isMounted) {
                    setBalances({
                        eth: parseFloat(ethBalance).toFixed(4),
                        usdc: parseFloat(usdcBalance).toFixed(2),
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

