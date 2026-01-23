import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import bcryptjs from 'bcryptjs'
import Dashboard from './Dashboard'
import MyReservations from './MyReservations'
import './App.css'

// Definiujemy główny komponent App
function Login() {

  const [login, setLogin] = useState('')

  const [password, setPassword] = useState('')

  const [message, setMessage] = useState('')

  const navigate = useNavigate()

  const handleLogin = async () => {
    // Pobierz użytkownika po loginie (bez porównania hasła)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('login', login)
      .single()

    if (error || !data) {
      setMessage('Niepoprawny login lub hasło')
      return
    }

    // Porównaj hasło wprowadzone z zahaszowanym w bazie
    const isPasswordValid = await bcryptjs.compare(password, data.password_hash)

    if (!isPasswordValid) {
      setMessage('Niepoprawny login lub hasło')
      return
    }

    setMessage('Zalogowano')
    // replace: true usuwa poprzedni wpis w historii, więc cofnięcie nie wraca do formularza
    navigate('/dashboard', { state: { userId: data.id, login: data.login }, replace: true })
  }

  return (
    // Główny kontener aplikacji
    <main className="app">
      <h1>System rezerwacji</h1>
      <div className="login-form">
        {/* Pole wejściowe do wpisania loginu */}
        <input
          type="text"
          placeholder="Login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
        />

        <input
          type="password"
          placeholder="Hasło"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button onClick={handleLogin}>Zaloguj</button>
        <p>{message}</p>
      </div>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/my-reservations" element={<MyReservations />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
export default App



