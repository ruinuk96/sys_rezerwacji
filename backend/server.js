import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE) // service key tylko w backendzie
const DEVICE_TOKEN = process.env.DEVICE_TOKEN // prosty sekret dla ESP32

// Prosty endpoint zdrowia serwisu
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.post('/pins/verify', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== DEVICE_TOKEN) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' })
    }

    const { pin, device_id } = req.body
    if (!pin) return res.status(400).json({ ok: false, reason: 'pin_required' })

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('pins')
      .select('id, pin_code, valid_from, valid_to, used, reservation_id')
      .eq('pin_code', pin)
      .lte('valid_from', now)
      .gte('valid_to', now)
      .single()

    if (error || !data) return res.status(403).json({ ok: false, reason: 'invalid_or_expired' })

    // Oznacz jako użyty wyślij w tle
    supabase.from('pins').update({ used: true }).eq('id', data.id)

    // Odpowiadaj natychmiast
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, reason: 'server_error' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`API on :${PORT}`))