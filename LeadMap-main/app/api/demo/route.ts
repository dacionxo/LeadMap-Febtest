import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Demo Request Handler
 * Captures demo requests and sends email notifications
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const body = await request.json()
    const { email, usageType, step } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Get request metadata
    const referrer = request.headers.get('referer') || ''
    const userAgent = request.headers.get('user-agent') || ''
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || ''

    if (step === 'email') {
      // Save email capture to database
      const { data, error } = await supabase
        .from('email_captures')
        .insert({
          email,
          source: 'demo_page',
          referrer,
          user_agent: userAgent,
          ip_address: ipAddress,
          metadata: {
            step: 'email',
            form_type: 'demo_request'
          },
          subscribed: true
        })
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        // Don't fail if email already exists, just continue
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          return NextResponse.json({ error: 'Failed to save email' }, { status: 500 })
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Email captured successfully',
        data 
      })
    }

    if (step === 'usage' && usageType) {
      // Update the email capture with usage type
      const { data: existingCapture } = await supabase
        .from('email_captures')
        .select('id, metadata')
        .eq('email', email)
        .eq('source', 'demo_page')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingCapture) {
        const updatedMetadata = {
          ...(existingCapture.metadata || {}),
          step: 'usage',
          usage_type: usageType
        }

        await supabase
          .from('email_captures')
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCapture.id)
      } else {
        // If no existing capture found, create a new one
        await supabase
          .from('email_captures')
          .insert({
            email,
            source: 'demo_page',
            referrer,
            user_agent: userAgent,
            ip_address: ipAddress,
            metadata: {
              step: 'usage',
              usage_type: usageType,
              form_type: 'demo_request'
            },
            subscribed: true
          })
      }

      // Send email notification
      // This sends an email to the user and optionally to your team
      try {
        let emailSent = false
        
        // Option 1: Using Resend (recommended for Next.js)
        // Install: npm install resend
        // Set RESEND_API_KEY in your .env file
        if (process.env.RESEND_API_KEY) {
          try {
            // Dynamic import with error handling
            // resend is an optional dependency - only import if available
            let resendModule: any = null
            try {
              // Use webpackIgnore to prevent Next.js from trying to resolve at build time
              // @ts-ignore - resend is optional
              resendModule = await import(/* webpackIgnore: true */ 'resend').catch(() => null)
            } catch (e) {
              // Module not found - resend is optional, continue without email
              console.log('Resend module not available, skipping email send')
              resendModule = null
            }
            
            if (resendModule && resendModule.Resend) {
              const { Resend } = resendModule
              const resend = new Resend(process.env.RESEND_API_KEY)
            
              // Send confirmation email to user
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'NextDeal <demo@nextdeal.com>',
                to: email,
                subject: 'Thank you for requesting a NextDeal demo',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #1a1a1a;">Thank you for your interest in NextDeal!</h1>
                    <p style="color: #666; line-height: 1.6;">
                      We've received your demo request and our team will reach out to you shortly to schedule your personalized demo.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                      <strong>Usage type:</strong> ${usageType}
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                      In the meantime, feel free to explore our platform or reach out if you have any questions.
                    </p>
                    <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                      Best regards,<br>
                      The NextDeal Team
                    </p>
                  </div>
                `
              })

              // Send notification to your team (optional)
              if (process.env.DEMO_NOTIFICATION_EMAIL) {
                await resend.emails.send({
                  from: process.env.RESEND_FROM_EMAIL || 'NextDeal <demo@nextdeal.com>',
                  to: process.env.DEMO_NOTIFICATION_EMAIL,
                  subject: `New Demo Request: ${email}`,
                  html: `
                    <div style="font-family: Arial, sans-serif;">
                      <h2>New Demo Request</h2>
                      <p><strong>Email:</strong> ${email}</p>
                      <p><strong>Usage Type:</strong> ${usageType}</p>
                      <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                      <p><strong>Referrer:</strong> ${referrer || 'Direct'}</p>
                    </div>
                  `
                })
              }
              emailSent = true
            } else {
              console.log('Resend package not installed. Install with: npm install resend')
            }
          } catch (resendError) {
            console.error('Resend error:', resendError)
            // Fall through to alternative email service
          }
        }
        
        // Option 2: Using native fetch with any email API
        if (!emailSent) {
          const emailServiceUrl = process.env.EMAIL_SERVICE_URL
          const emailServiceApiKey = process.env.EMAIL_SERVICE_API_KEY
          
          if (emailServiceUrl && emailServiceApiKey) {
            await fetch(emailServiceUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${emailServiceApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'demo@nextdeal.com',
                to: email,
                subject: 'Thank you for requesting a NextDeal demo',
                html: `
                  <h1>Thank you for your interest!</h1>
                  <p>We've received your demo request and will contact you shortly.</p>
                  <p>Usage type: ${usageType}</p>
                `
              }),
            })
            emailSent = true
          } else {
            // Log if no email service is configured
            console.log('Demo request received (no email service configured):', {
              email,
              usageType,
              timestamp: new Date().toISOString()
            })
            console.log('To enable email sending, set RESEND_API_KEY or EMAIL_SERVICE_URL in your .env file')
          }
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError)
        // Don't fail the request if email sending fails
        // The data is already saved to the database
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Demo request submitted successfully' 
      })
    }

    return NextResponse.json({ error: 'Invalid step or missing data' }, { status: 400 })
  } catch (error: any) {
    console.error('Demo request error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

