import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ChatProvider } from './contexts/ChatContext'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Chat } from './components/Chat'
import { Settings } from './pages/Settings'
import { ChatLayout } from './layouts/ChatLayout'
import { ProtectedRoute } from './components/auth/protected-route'

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<ChatProvider><ChatLayout /></ChatProvider>}>
              <Route path="/chats" element={<Chat />} />
              <Route path="/chats/:id" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Redirect root to chats */}
          <Route path="/" element={<Navigate to="/chats" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </AuthProvider>
    </Router>
  )
}
