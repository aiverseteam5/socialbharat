import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/msg91'
import { sendOtpSchema } from '@/types/schemas'

// Simple in-memory rate limiting (for MVP - replace with Upstash Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(phone: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(phone)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(phone, { count: 1, resetTime: now + 10 * 60 * 1000 }) // 10 minutes
    return true
  }
  
  if (record.count >= 5) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate with Zod schema
    const validationResult = sendOtpSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid phone number', details: validationResult.error.errors },
        { status: 400 }
      )
    }
    
    const { phone } = validationResult.data
    
    // Rate limiting: 5 requests per phone per 10 minutes
    if (!checkRateLimit(phone)) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Send OTP via MSG91
    const result = await sendOtp(phone)
    
    return NextResponse.json({
      message: result.message,
      expiresIn: result.expiresIn,
    })
  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    )
  }
}
