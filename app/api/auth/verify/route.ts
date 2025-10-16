import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { generatePassword } from '@/lib/utils';

const client = createPublicClient({ chain: base, transport: http() })
// Simple in-memory nonce store (swap for Redis or DB in production)
const nonces = new Set<string>()

export async function POST(request: NextRequest) {
    try {
        const { address, message, signature } = await request.json()

        if (!address || !message || !signature) {
            return NextResponse.json({
                error: 'Missing required fields: address, message, signature'
            }, { status: 400 })
        }

        console.log('Verifying signature for address:', address)

        // Extract nonce from message (SIWE format)
        const nonce = message.match(/Nonce: (\w+)/)?.[1]
        if (!nonce) {
            return NextResponse.json({
                error: 'Invalid message format - nonce not found'
            }, { status: 400 })
        }

        // Check if nonce is valid and not reused
        if (!nonces.has(nonce)) {
            return NextResponse.json({
                error: 'Invalid or expired nonce'
            }, { status: 401 })
        }

        // Remove nonce to prevent reuse
        nonces.delete(nonce)

        // Verify the signature
        const isValid = await client.verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        })

        if (!isValid) {
            return NextResponse.json({
                error: 'Invalid signature'
            }, { status: 401 })
        }

        console.log('✅ Signature verified successfully for address:', address);

        const simulatedEmail = `${address}@siwe.subvault.xyz`;
        const password = generatePassword(address);

        const supabase = await createClient();
        const supabaseAdmin = await createAdminClient();
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id')
            .eq('address', address)
            .maybeSingle();

        if (profileError) return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });

        let userId: string;
        if (profile) {
            userId = profile.user_id;
        } else {
            // Create new user if not found
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: simulatedEmail, // Fake email (not used)
                email_confirm: true, // Skip confirmation
                user_metadata: { ethereum_address: address },
                password: password,
            });
            if (createError) {
                console.error('Failed to create user:', createError);
                return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
            }
            userId = newUser.user.id;
        }

        const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
            email: simulatedEmail,
            password,
        });

        if (signInError || !session) return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 });

        return NextResponse.json({ ok: true, address, session: session });
    } catch (error) {
        console.error('Auth verification error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET() {
    // Generate a secure random nonce
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    const nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    // Add to nonce store
    nonces.add(nonce)

    console.log('Generated nonce:', nonce)
    return NextResponse.json({ nonce })
}