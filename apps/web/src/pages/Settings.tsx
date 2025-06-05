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
} from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Moon },
];

export const Settings = () => {
  const navigate = useNavigate();
  const { currentUser } = useChat();
  const [activeTab, setActiveTab] = useState('profile');
  const [isDark, setIsDark] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    messageNotifications: true,
    soundEnabled: true,
    emailNotifications: false,
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
                <button className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-primary-foreground shadow-lg">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-medium">{currentUser.username}</h3>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
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
    <div className="flex h-screen bg-background">
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
            onClick={() => navigate('/login')}
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
    </div>
  );
}; 