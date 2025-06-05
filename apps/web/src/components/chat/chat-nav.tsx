import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/button'
import { logout } from '../../lib/api'
import { LogOut } from 'lucide-react'

export function ChatNav() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear()
      navigate('/login')
    },
  })

  return (
    <nav className="flex items-center justify-between border-b bg-background p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Talkify</h1>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </nav>
  )
} 