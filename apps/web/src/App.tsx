import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Chat } from './pages/Chat'
import { ChatOverview } from './pages/ChatOverview'
import { Settings } from './pages/Settings'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { LoginForm } from './components/auth/login-form'
import { RegisterForm } from './components/auth/register-form'
import { ChatProvider } from './contexts/ChatContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/chats" element={<ChatOverview />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
          </Routes>
        </ChatProvider>
      </Router>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}

export default App
