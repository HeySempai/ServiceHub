import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('Webhook payload:', payload)

    const { type, record, old_record } = payload
    const booking = type === 'DELETE' ? old_record : record
    if (!booking || !booking.org_id) {
      return new Response('No booking to process', { status: 400 })
    }

    const orgId = booking.org_id
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get Calendar Connection
    const { data: connection, error: connError } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .eq('active', true)
      .maybeSingle()

    if (connError || !connection) {
      console.log('No active Google calendar connection for org:', orgId)
      return new Response('No connection', { status: 200, headers: corsHeaders })
    }

    let credentials = connection.credentials

    // 2. Refresh Token if needed
    const expiresAtMs = credentials.expires_at ? new Date(credentials.expires_at).getTime() : 0;

    if (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60000) {
      console.log('Refreshing Google token...')
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        })
      })

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh Google token')
      }

      const tokenData = await tokenResponse.json()
      credentials = {
        ...credentials,
        access_token: tokenData.access_token,
        // Only update refresh_token if Google actually sent a new one
        ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }

      await supabaseClient
        .from('calendar_connections')
        .update({ credentials })
        .eq('id', connection.id)
    }

    const accessToken = credentials.access_token

    // 3. For INSERT/UPDATE, fetch additional booking info (client, service)
    let summary = 'Cita ServiceHub'
    let description = ''

    if (type !== 'DELETE') {
      const { data: bookingDetails } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          notes,
          clients (first_name, last_name, phone, email),
          services (name),
          org_members (display_name)
        `)
        .eq('id', booking.id)
        .single()

      if (bookingDetails) {
        summary = `${bookingDetails.clients?.first_name || ''} ${bookingDetails.clients?.last_name || ''} - ${bookingDetails.services?.name}`.trim()
        description = `Cliente: ${bookingDetails.clients?.first_name || ''} ${bookingDetails.clients?.last_name || ''}\nTelefono: ${bookingDetails.clients?.phone || 'N/A'}\nEmail: ${bookingDetails.clients?.email || 'N/A'}\nServicio: ${bookingDetails.services?.name || 'N/A'}\nProveedor: ${bookingDetails.org_members?.display_name || 'N/A'}\nNotas: ${bookingDetails.notes || 'Ninguna'}`
      }
    }

    // 4. Transform to Google Event
    const event = {
      summary,
      description,
      start: { dateTime: booking.start_at },
      end: { dateTime: booking.end_at },
      extendedProperties: {
        private: {
          servicehub_booking_id: booking.id
        }
      }
    }

    const calendarId = 'primary'
    const eventId = booking.google_event_id

    // 5. Send to Google API
    let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
    let method = 'POST'

    if (type === 'DELETE' && eventId) {
      apiUrl = `${apiUrl}/${eventId}`
      method = 'DELETE'
    } else if (type === 'UPDATE' && eventId) {
      apiUrl = `${apiUrl}/${eventId}`
      method = 'PUT'
    } else if (type === 'UPDATE' && !eventId) {
      // It's an update but no google_event_id exists yet, meaning it failed initially. We POST a new one.
      method = 'POST'
    }

    const googleReqOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }

    if (method !== 'DELETE') {
      googleReqOptions.body = JSON.stringify(event)
    }

    console.log(`Sending ${method} request to Google Calendar API...`)
    const googleRes = await fetch(apiUrl, googleReqOptions)

    if (!googleRes.ok) {
      const errText = await googleRes.text()
      console.error('Google API Error:', errText)
      throw new Error(`Google API returned ${googleRes.status}: ${errText}`)
    }

    // 6. If it was a POST (new event created), update our database with the generated Google Event ID
    if (method === 'POST') {
      const gEvent = await googleRes.json()
      await supabaseClient
        .from('bookings')
        .update({ google_event_id: gEvent.id })
        .eq('id', booking.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
