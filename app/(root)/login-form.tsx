"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { createBaseAccountSDK } from '@base-org/account';

import loginImage from '@/assets/login-image.webp';
import Image from "next/image"
import { useCallback } from "react"
import { setSession } from "@/lib/supabase/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { storeSubAccount } from "@/app/app/vaults/actions"
import { getBaseAccountSDK } from "@/lib/base"

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {

    const supabase = createClient();
    const { setUser, setAddress, network, setNetwork } = useAuth();
    const router = useRouter();

    const handleSignIn = useCallback(async () => {
        try {
            const sdk = createBaseAccountSDK(
                {
                    appName: 'SubVault',
                    appLogoUrl: 'https://base.org/logo.png',
                }
            );

            const provider = sdk.getProvider();
            await provider.request({ method: 'wallet_connect' });
            // 1 — Get a fresh nonce from the server
            const nonceResponse = await fetch('/api/auth/verify', { method: 'GET' });
            const { nonce } = await nonceResponse.json();

            const connectResponse = await provider.request({
                method: "wallet_connect",
                params: [
                    {
                        version: "1",
                        capabilities: {
                            signInWithEthereum: {
                                chainId: network === 'base' ? '0x2105' : '0x14A34',
                                nonce,
                            },
                        },
                    },
                ],
            }) as {
                accounts: { address: string }[],
                signInWithEthereum?: {
                    message: string,
                    signature: string
                }
            };

            console.log("Connect response:", connectResponse);
            const { address } = connectResponse.accounts[0];

            if (connectResponse.signInWithEthereum) {
                const { message, signature } = connectResponse.signInWithEthereum;
                console.log('SIWE message:', message);
                console.log('SIWE signature:', signature);

                // 4 — Verify signature on the server
                const verifyResponse = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, message, signature })
                });

                const { session, error } = await verifyResponse.json();
                if (error) {
                    throw new Error(error || 'Signature verification failed');
                }

                const success = await setSession(supabase, session);
                if (!success) {
                    throw new Error('Session set failed');
                }
                
                // Store sub account address (auto-created on connect)
                try {
                    const sdk = getBaseAccountSDK()
                    const subProvider = sdk.getProvider()
                    const accounts = await subProvider.request({
                        method: "eth_accounts",
                        params: [],
                    }) as string[]
                    
                    if (accounts.length > 0) {
                        const subAccountAddress = accounts[0] // First account with defaultAccount: 'sub'
                        await storeSubAccount(subAccountAddress)
                    }
                } catch (subAccountError) {
                    console.error("Failed to store sub account:", subAccountError)
                    // Don't fail the login, just log the error
                }
                
                setUser(session.user);
                setAddress(address);
                router.refresh();
            } else {
                // Fallback: manual signing if SIWE not available
                console.log("⚠️ SIWE not available, using manual signing");

                // Create SIWE message manually
                const domain = window.location.host;
                const uri = window.location.origin;
                const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSubVault Authentication\n\nURI: ${uri}\nVersion: 1\nChain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID || 84532}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

                // Request signature
                const signature = await provider.request({
                    method: 'personal_sign',
                    params: [message, address]
                });

                // Verify signature on server
                const verifyResponse = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, message, signature })
                });

                const { session, error } = await verifyResponse.json();
                if (error) {
                    throw new Error(error || 'Signature verification failed');
                }

                const success = await setSession(supabase, session);
                if (!success) {
                    throw new Error('Session set failed');
                }
                
                // Store sub account address (auto-created on connect)
                try {
                    const sdk = getBaseAccountSDK()
                    const subProvider = sdk.getProvider()
                    const accounts = await subProvider.request({
                        method: "eth_accounts",
                        params: [],
                    }) as string[]
                    
                    if (accounts.length > 0) {
                        const subAccountAddress = accounts[0] // First account with defaultAccount: 'sub'
                        await storeSubAccount(subAccountAddress)
                    }
                } catch (subAccountError) {
                    console.error("Failed to store sub account:", subAccountError)
                    // Don't fail the login, just log the error
                }
                
                setUser(session.user);
                setAddress(address);
                router.refresh();
            }

        } catch (error) {
            console.error('Sign in failed:', error);
        }
    }, [network]);

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-6 md:p-8">
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-bold">Welcome to SubVault</h1>
                                <p className="text-muted-foreground">
                                    Secure your treasury with Base Sub Accounts
                                </p>
                            </div>

                            <div className="space-y-4 py-4">
                                <div className="flex gap-3">
                                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold">Frictionless Transactions</h3>
                                        <p className="text-muted-foreground text-sm">No repeated signing prompts. Sub Accounts enable seamless treasury operations.</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold">No Funding Required</h3>
                                        <p className="text-muted-foreground text-sm">Spend Permissions let Sub Accounts use your Base Account balance directly.</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold">Full User Control</h3>
                                        <p className="text-muted-foreground text-sm">Manage all Sub Accounts and Spend Permissions in the app.</p>
                                    </div>
                                </div>
                            </div>

                            <Field>
                                <FieldLabel>Network</FieldLabel>
                                <FieldDescription>Select the network you want to use</FieldDescription>
                                <Select value={network} onValueChange={setNetwork}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a network" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="base">Base</SelectItem>
                                        <SelectItem value="base-sepolia">Base Sepolia</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <Button type="button" onClick={handleSignIn} className="w-full" size="lg">
                                    Sign in with Base
                                </Button>
                            </Field>
                            <FieldDescription className="text-center">
                                Don&apos;t have a Base account? <a target="_blank" href="https://join.base.app/" className="hover:!text-foreground">Create one</a>
                            </FieldDescription>
                        </FieldGroup>
                    </form>
                    <div className="bg-muted relative hidden md:block">
                        <Image
                            src={loginImage.src}
                            alt="Image"
                            width={500}
                            height={500}
                            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.8]"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
