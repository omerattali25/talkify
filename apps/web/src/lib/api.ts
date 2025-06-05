import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth
export const login = (email: string, password: string) =>
  api.post('/users/login', { email, password })

export const register = (email: string, password: string, name: string) =>
  api.post('/users', { email, password, username: name, phone: "N/A" })

export const logout = () => api.post('/users/logout')

// User Profile
export const getCurrentUser = () => api.get('/users/me')
export const updateProfile = (data: any) => api.put('/users/me', data)
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.put('/users/me/password', { current_password: currentPassword, new_password: newPassword })
export const getUser = (id: string) => api.get(`/users/${id}`)

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