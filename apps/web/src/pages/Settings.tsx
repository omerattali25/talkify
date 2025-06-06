import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  Camera,
  Mail,
  Lock,
  LogOut,
  Trash,
  Volume2,
  VolumeX,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Moon },
];

export const Settings = () => {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [isDark, setIsDark] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newEmail, setNewEmail] = useState(currentUser?.email || '');
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [password, setPassword] = useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    messageNotifications: true,
    soundEnabled: true,
    emailNotifications: false,
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      // We'll use changePassword with the same password to verify it
      // This will fail if the current password is incorrect
      try {
        await api.changePassword(password, password);
        return true;
      } catch (error) {
        throw new Error('Invalid password. Please try again.');
      }
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { email?: string; username?: string; password?: string }) => {
      // If updating username, require password confirmation
      if (data.username && data.username !== currentUser?.username) {
        if (!data.password) {
          setShowPasswordConfirm(true);
          throw new Error('Please confirm your password to update username');
        }
        
        // First verify the password
        await verifyPasswordMutation.mutateAsync(data.password);
      }

      const response = await api.updateProfile(data);
      
      // If username was updated successfully
      if (data.username && data.username !== currentUser?.username) {
        // Clear all query cache
        queryClient.clear();
        // Remove auth token
        localStorage.removeItem('token');
        // Navigate to login
        window.location.href = '/login'; // Use window.location.href for a full page reload
        toast.success('Username updated successfully. Please login with your new username.');
      } else {
        // For other updates, just show success message
        toast.success('Profile updated successfully');
      }
      
      return response;
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
      // Reset the form values on error
      setNewEmail(currentUser?.email || '');
      setNewUsername(currentUser?.username || '');
      setPassword('');
    },
  });

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleUpdateProfile = async (field: 'email' | 'username') => {
    try {
      if (field === 'email' && newEmail !== currentUser?.email) {
        await updateProfileMutation.mutateAsync({ email: newEmail });
        setIsEditingEmail(false);
      } else if (field === 'username' && newUsername !== currentUser?.username) {
        await updateProfileMutation.mutateAsync({ 
          username: newUsername,
          password: password 
        });
        setIsEditingUsername(false);
        setShowPasswordConfirm(false);
        setPassword('');
      }
    } catch (error) {
      // Error is handled in mutation's onError
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all query cache
      queryClient.clear();
      // Remove auth token
      localStorage.removeItem('token');
      // Call logout
      await logout();
      // Force a full page reload to clear all state
      window.location.href = '/login';
    } catch (error) {
      toast.error('Failed to logout');
      // Still try to clear everything and redirect
      queryClient.clear();
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="group relative mx-auto mb-4 h-24 w-24">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10">
                  <span className="text-3xl font-medium text-primary">
                    {currentUser.username[0].toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                {isEditingUsername ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-1 text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter username"
                    />
                    <button
                      onClick={() => handleUpdateProfile('username')}
                      className="rounded-full p-1 text-green-500 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewUsername(currentUser.username);
                        setIsEditingUsername(false);
                      }}
                      className="rounded-full p-1 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-medium cursor-pointer" onClick={() => setIsEditingUsername(true)}>
                    {currentUser.username}
                  </h3>
                )}
                {isEditingEmail ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-1 text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter email"
                    />
                    <button
                      onClick={() => handleUpdateProfile('email')}
                      className="rounded-full p-1 text-green-500 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewEmail(currentUser.email);
                        setIsEditingEmail(false);
                      }}
                      className="rounded-full p-1 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground cursor-pointer" onClick={() => setIsEditingEmail(true)}>
                    {currentUser.email}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <button className="flex w-full items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">Email Address</p>
                    <p className="text-sm text-muted-foreground">Change your email</p>
                  </div>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>

              <button className="flex w-full items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">Change your password</p>
                  </div>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>

              <button className="flex w-full items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-destructive/10">
                <div className="flex items-center gap-3">
                  <Trash className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Delete your account and all data
                    </p>
                  </div>
                </div>
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Message Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you receive messages
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      messageNotifications: !prev.messageNotifications,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    notificationSettings.messageNotifications
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      notificationSettings.messageNotifications ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  {notificationSettings.soundEnabled ? (
                    <Volume2 className="h-5 w-5 text-primary" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">Sound</p>
                    <p className="text-sm text-muted-foreground">
                      Play sound for new messages
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      soundEnabled: !prev.soundEnabled,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    notificationSettings.soundEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      notificationSettings.soundEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified via email for important updates
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      emailNotifications: !prev.emailNotifications,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    notificationSettings.emailNotifications
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      notificationSettings.emailNotifications ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon className="h-5 w-5 text-primary" />
                ) : (
                  <Sun className="h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Toggle dark mode on or off
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isDark ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    isDark ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <button
            onClick={() => navigate('/chats')}
            className="rounded-full p-2 hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">Settings</h2>
        </div>
        <nav className="p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="mx-auto max-w-2xl"
        >
          {renderTabContent()}
        </motion.div>
      </div>

      {showPasswordConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Confirm Password</h3>
            <p className="mb-4">Please enter your current password to update your username</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 mb-4"
              placeholder="Enter your password"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasswordConfirm(false);
                  setPassword('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateProfile('username')}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                disabled={verifyPasswordMutation.isPending || updateProfileMutation.isPending}
              >
                {verifyPasswordMutation.isPending ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 