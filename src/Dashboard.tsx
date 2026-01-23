import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './App.css'
import { supabase } from './supabaseClient'

type Reservation = {
  id: number
  start_time: string
  end_time: string
  user_id?: number
  status?: string
}


function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  const userId = (location.state as { userId?: number } | null)?.userId
  const login = (location.state as { login?: string } | null)?.login

  // Jeśli brak loginu lub userId (np. odświeżenie) — wróć na /app
   useEffect(() => {
    if (!userId || !login) {
      navigate('/app', { replace: true })
    }
  }, [userId, login, navigate])

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [generatedPin, setGeneratedPin] = useState('')


  useEffect(() => {
    const fetchReservations = async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
      if (error) {
        setReservations([])
        return
      }
      setReservations(data ?? [])
    }
    fetchReservations()
  }, [])

  const isReserved = (date: Date, hour: number): boolean => {
    return reservations.some((reservation) => {
      const startTime = new Date(reservation.start_time)
      const endTime = new Date(reservation.end_time)
      const checkStart = new Date(date)
      checkStart.setHours(hour, 0, 0, 0)
      const checkEnd = new Date(date)
      checkEnd.setHours(hour + 1, 0, 0, 0)
      
      return startTime < checkEnd && endTime > checkStart
    })
  }

  // Funkcja generująca klucz slotu (data + godzina)
  const getSlotKey = (date: Date, hour: number): string => {
    return `${date.toISOString().split('T')[0]} ${hour}`
  }

  // Sprawdź czy slot jest wybrany
  const isSelected = (date: Date, hour: number): boolean => {
    return selectedSlots.includes(getSlotKey(date, hour))
  }

  // Obsługa kliknięcia w komórkę
  const handleSlotClick = (date: Date, hour: number) => {
    if (isReserved(date, hour)) return // zablokowane

    const slotKey = getSlotKey(date, hour)
    
    if (selectedSlots.includes(slotKey)) {
      // Odznacz
      setSelectedSlots(selectedSlots.filter(s => s !== slotKey))
    } else {
      // Zaznacz, jeśli spełnia warunki
      const newSelection = [...selectedSlots, slotKey].sort()
      
      // Walidacja: max 3 sloty
      if (newSelection.length > 3) return
      
      // Walidacja: muszą być po kolei (ta sama data, kolejne godziny)
      if (newSelection.length > 1 && !areConsecutive(newSelection)) return
      
      setSelectedSlots(newSelection)
    }
  }

  // Sprawdź czy sloty są kolejne
  const areConsecutive = (slots: string[]): boolean => {
    if (slots.length <= 1) return true
    
    const parsed = slots.map(s => {
      const [dateStr, hourStr] = s.split(' ')
      return { date: dateStr, hour: parseInt(hourStr) }
    })
    
    // Wszystkie muszą być tego samego dnia
    const firstDate = parsed[0].date
    if (!parsed.every(p => p.date === firstDate)) return false
    
    // Godziny muszą być kolejne
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].hour !== parsed[i - 1].hour + 1) return false
    }
    
    return true
  }

  // Generuj PIN 
  const generatePin = (): string => {
    while (true) {
      const buffer = new Uint32Array(1)
      crypto.getRandomValues(buffer)
      const value = buffer[0]

      const max = 0xffffffff
      const limit = max - (max % 1_000_000)

      if (value < limit) {
        return (value % 1_000_000).toString().padStart(6, '0')
      }
    }
  }


  // Obsługa rezerwacji
  const handleReservation = async () => {
    if (selectedSlots.length === 0 || !userId) return
    console.log('selectedSlots:', selectedSlots)
    // Parsuj pierwszy i ostatni slot
    const sorted = [...selectedSlots].sort()
    const [firstDateStr, firstHourStr] = sorted[0].split(' ')
    const [lastDateStr, lastHourStr] = sorted[sorted.length - 1].split(' ')
    console.log('firstDateStr:', firstDateStr)  // pokaż datę
  console.log('firstHourStr:', firstHourStr)  // pokaż godzinę
    
    const [year, month, day] = firstDateStr.split('-').map(Number)
    const startTime = new Date(year, month - 1, day + 1, parseInt(firstHourStr), 0, 0, 0)
    
    const [yearEnd, monthEnd, dayEnd] = lastDateStr.split('-').map(Number)
    const endTime = new Date(yearEnd, monthEnd - 1, dayEnd + 1, parseInt(lastHourStr) + 1, 0, 0, 0)
    console.log('startTime:', startTime)  // pokaż ostateczną datę
  console.log('startTime ISO:', startTime.toISOString())  // w formacie SQL
    
    // Wstaw rezerwację
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .insert({
        user_id: userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'active'
      })
      .select()
      .single()
    
    if (resError || !resData) {
      alert('Błąd podczas tworzenia rezerwacji')
      return
    }
    
    // Generuj PIN
    const pin = generatePin()
    
    // Wstaw PIN
    const { error: pinError } = await supabase
      .from('pins')
      .insert({
        reservation_id: resData.id,
        pin_code: pin,
        valid_from: startTime.toISOString(),
        valid_to: endTime.toISOString(),
        used: false
      })
    
    if (pinError) {
      alert('Błąd podczas generowania PIN')
      return
    }
    
    // Pokaż modal z PIN-em
    setGeneratedPin(pin)
    setShowModal(true)
    setSelectedSlots([])
    
    // Odśwież rezerwacje
    const { data: newReservations } = await supabase
      .from('reservations')
      .select('*')
    setReservations(newReservations ?? [])
  }


  // Dzień startowy tygodnia (poniedziałek)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = niedziela, 1 = pon, ..., 6 = sob
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // przesunięcie do poniedziałku
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0) // zeruj czas
    return monday
  })

  // Dni tygodnia
  const dayNames = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
  
  // Godziny (przedziały)
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

  // Generuj daty dla aktualnego tygodnia
  const getWeekDates = () => {
    return dayNames.map((_, index) => {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + index)
      return date
    })
  }

  const weekDates = getWeekDates()

  // Przesunięcie o tydzień
  const changeWeek = (weeks: number) => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + weeks * 7)
    setCurrentWeekStart(newDate)
  }

  // Formatowanie daty (np. "13.01.2026")
  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }

  return (
    <main className="app">
      <h1>Panel użytkownika</h1>
      <div style={{ display: 'flex'}}>
        <div style={{marginRight: 'auto'}}><span>Użytkownik: <strong>{login}</strong></span></div>
        <div style={{}}><button onClick={() => navigate('/my-reservations', { state: { userId, login } })}>
          Twoje rezerwacje
        </button></div>
        <div style={{marginLeft: 'auto'}}><button onClick={() => navigate('/app', { replace: true })}>Wyloguj</button></div>
      </div>
      
      {/* Nawigacja tygodniami */}
      <div>
        <button onClick={() => changeWeek(-1)}>←</button>
        <span>
          Tydzień: {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
        </span>
        <button onClick={() => changeWeek(1)}>→</button>
      </div>
      
      <div>
        <table>
          <thead>
            <tr>
              <th>Godzina</th>
              {weekDates.map((date, index) => (
                <th key={index}>
                  {dayNames[index]}<br />
                  <small>{formatDate(date)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td>
                  {hour}:00 - {hour + 1}:00
                </td>
                {weekDates.map((date) => {
                  const reserved = isReserved(date, hour)
                  const selected = isSelected(date, hour)
                  
                  let bgColor = '#51cf66' 
                  if (reserved) bgColor = '#ff6b6b' 
                  if (selected) bgColor = '#4dabf7' 
                  
                  return (
                    <td 
                      key={`${date.toISOString()}-${hour}`} 
                      onClick={() => handleSlotClick(date, hour)}
                      style={{ 
                        background: bgColor,
                        cursor: reserved ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {/* komórka */}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Przycisk rezerwacji */}
      {selectedSlots.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={handleReservation} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Zarezerwuj ({selectedSlots.length} {selectedSlots.length === 1 ? 'godzinę' : 'godziny'})
          </button>
        </div>
      )}

      {/* Modal z PIN-em */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <h2>Rezerwacja potwierdzona!</h2>
            <p>Twój kod PIN:</p>
            <h1 style={{ fontSize: '48px', margin: '20px 0', color: '#228be6' }}>{generatedPin}</h1>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Zapisz ten kod. Będzie aktywny tylko w trakcie trwania rezerwacji.
            </p>
            <button onClick={() => setShowModal(false)} style={{ marginTop: '20px', padding: '10px 30px' }}>
              Zamknij
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default Dashboard
