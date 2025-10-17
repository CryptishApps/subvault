import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { generatePassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
    try {
        const { address, message, signature } = await request.json()

        if (!address || !message || !signature) {
            return NextResponse.json({
                error: 'Missing required fields: address, message, signature'
            }, { status: 400 })
        }

        console.log('🔐 Verifying signature for address:', address)
        console.log('📝 Message to verify:', message)
        console.log('✍️  Signature:', signature)

        // Extract nonce from message (SIWE format)
        const nonce = message.match(/Nonce: (\w+)/)?.[1]
        if (!nonce) {
            return NextResponse.json({
                error: 'Invalid message format - nonce not found'
            }, { status: 400 })
        }

        // Extract chain ID from message to use correct chain
        const chainIdMatch = message.match(/Chain ID: (\d+)/)
        const chainId = chainIdMatch ? parseInt(chainIdMatch[1]) : 8453 // Default to Base mainnet
        const chain = chainId === 84532 ? baseSepolia : base
        
        console.log('⛓️  Using chain:', chain.name, `(ID: ${chainId})`)

        // Check if nonce exists and is not expired in Supabase
        const supabaseAdmin = await createAdminClient()
        const { data: nonceRecord, error: nonceError } = await supabaseAdmin
            .from('auth_nonces')
            .select('nonce')
            .eq('nonce', nonce)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle()

        if (nonceError || !nonceRecord) {
            return NextResponse.json({
                error: 'Invalid or expired nonce'
            }, { status: 401 })
        }

        // Remove nonce to prevent reuse
        await supabaseAdmin
            .from('auth_nonces')
            .delete()
            .eq('nonce', nonce)

        // Create viem client with the correct chain and RPC endpoint
        // Use environment variables for RPC URLs to avoid rate limits in production
        const rpcUrl = chainId === 84532 
            ? process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
            : process.env.BASE_RPC_URL || 'https://mainnet.base.org'
            
        const client = createPublicClient({ 
            chain, 
            transport: http(rpcUrl)
        })

        // Verify the signature
        console.log('🔍 Verifying with RPC:', rpcUrl)
        const isValid = await client.verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`
        })

        if (!isValid) {
            console.error('❌ Signature verification failed for address:', address)
            console.error('   Chain:', chain.name, `(ID: ${chainId})`)
            console.error('   Message:', message)
            console.error('   Signature:', signature)
            return NextResponse.json({
                error: 'Invalid signature'
            }, { status: 401 })
        }

        console.log('✅ Signature verified successfully for address:', address)

        const simulatedEmail = `${address}@siwe.subvault.xyz`
        const password = generatePassword(address)

        const supabase = await createClient()
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id')
            .eq('address', address)
            .maybeSingle()

        if (profileError) return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 })

        let userId: string
        if (profile) {
            userId = profile.user_id
        } else {
            // Create new user if not found
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: simulatedEmail,
                email_confirm: true,
                user_metadata: { ethereum_address: address },
                password: password,
            })
            if (createError) {
                console.error('Failed to create user:', createError)
                return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
            }
            userId = newUser.user.id
        }

        const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
            email: simulatedEmail,
            password,
        })

        if (signInError || !session) return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })

        return NextResponse.json({ ok: true, address, session: session })
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

    // Store in Supabase with 5 minute expiration
    const supabaseAdmin = await createAdminClient()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
    
    await supabaseAdmin
        .from('auth_nonces')
        .insert({ nonce, expires_at: expiresAt.toISOString() })

    console.log('Generated nonce:', nonce)
    return NextResponse.json({ nonce })
}
