import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../lib/api'

export function ProtectedRoute() {
  const location = useLocation()
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
} 