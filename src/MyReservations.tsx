import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import './App.css'

type Reservation = {
  id: number
  user_id: number
  start_time: string
  end_time: string
  status: string
}

type Pin = {
  id: number
  reservation_id: number
  pin_code: string
  valid_from: string
  valid_to: string
  used: boolean
}

function MyReservations() {
  const navigate = useNavigate()
  const location = useLocation()

  const userId = (location.state as { userId?: number } | null)?.userId
  const login = (location.state as { login?: string } | null)?.login

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [pins, setPins] = useState<{ [key: number]: Pin }>({})
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all')


  useEffect(() => {
    if (!userId || !login) {
      navigate('/app', { replace: true })
    }
  }, [userId, login, navigate])


  useEffect(() => {
    const fetchReservations = async () => {
      if (!userId) return

      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', userId)

      if (resError || !resData) {
        setReservations([])
        return
      }

      setReservations(resData)

      const { data: pinData, error: pinError } = await supabase
        .from('pins')
        .select('*')
        .in('reservation_id', resData.map(r => r.id))

      if (!pinError && pinData) {
        const pinMap: { [key: number]: Pin } = {}
        pinData.forEach((pin: Pin) => {
          pinMap[pin.reservation_id] = pin
        })
        setPins(pinMap)
      }
    }

    fetchReservations()
  }, [userId])


  const formatStartDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  const formatEndDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Anuluj rezerwację
  const handleCancel = async (reservationId: number) => {
    const confirmed = confirm('Czy naprawdę chcesz anulować tę rezerwację?')
    if (!confirmed) return

    // najpierw usuń PIN
    const { error: pinError } = await supabase
      .from('pins')
      .delete()
      .eq('reservation_id', reservationId)

    if (pinError) {
      alert('Błąd podczas usuwania PIN-ów')
      return
    }

    // potem usuń rezerwację
    const { error: resError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId)

    if (resError) {
      alert('Błąd podczas anulowania rezerwacji: ' + resError.message)
      return
    }

    // Odśwież listę
    const { data: newReservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)

    setReservations(newReservations ?? [])
    
    // Odśwież PINy
    const { data: newPins } = await supabase
      .from('pins')
      .select('*')
      .in('reservation_id', (newReservations ?? []).map(r => r.id))

    if (newPins) {
      const pinMap: { [key: number]: Pin } = {}
      newPins.forEach((pin: Pin) => {
        pinMap[pin.reservation_id] = pin
      })
      setPins(pinMap)
    }
  }

  const filteredReservations = reservations.filter((reservation) => {
    if (statusFilter === 'all') return true
    return reservation.status === statusFilter
  })

  return (
    <main className="app">
      <h1>Twoje rezerwacje</h1>
      <div style={{ display: 'flex'}}>
        <div style={{ marginRight: 'auto'}}>Użytkownik: <strong>{login}</strong></div>
        <div style={{ marginLeft: 'auto'}}>
        <button onClick={() => navigate('/dashboard', { state: { userId, login }, replace: true })}>
          Powrót do kalendarza
        </button>
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span>Filtr statusu:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'ended')}
        >
          <option value="all">Wszystkie</option>
          <option value="active">Aktywne</option>
          <option value="ended">Zakończone</option>
        </select>
      </div>
      
      {/*Lista rezerwacji*/}
      {filteredReservations.length === 0 ? (
        <p style={{ marginTop: '20px' }}>Nie masz żadnych rezerwacji.</p>
      ) : (
        <ul style={{ marginTop: '20px', listStyle: 'none', padding: 0 }}>
          {filteredReservations.map((reservation) => {
            const pin = pins[reservation.id]
            return (
              <li
                key={reservation.id}
                style={{
                  border: '1px solid #ccc',
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '4px',
                }}
              >
                <div>
                  <strong>Data i czas:</strong> {formatStartDate(reservation.start_time)} - {formatEndDate(reservation.end_time)}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong>PIN:</strong> {pin ? <code style={{ fontSize: '18px', fontWeight: 'bold', color: '#228be6' }}>{pin.pin_code}</code> : 'Brak PIN-u'}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Status: </strong> 
                  {reservation.status === 'active' ? <span style={{color: 'green'}}>Aktywna</span> : reservation.status === 'ended' ? <span style={{color: 'red'}}>Zakończona</span> : ''}
                </div>
                <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => handleCancel(reservation.id)}
                >
                  Anuluj rezerwację
                </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default MyReservations
