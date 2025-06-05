import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const register = (email: string, password: string, name: string) =>
  api.post('/auth/register', { email, password, name })

export const logout = () => api.post('/auth/logout')

// Messages
export const getMessages = (conversationId: string) =>
  api.get(`/messages/${conversationId}`)

export const sendMessage = (conversationId: string, content: string) =>
  api.post(`/messages/${conversationId}`, { content })

// Conversations
export const getConversations = () => api.get('/conversations')

export const createConversation = (userId: string) =>
  api.post('/conversations', { userId })

// Users
export const getUsers = () => api.get('/users')

export const getCurrentUser = () => api.get('/users/me') 