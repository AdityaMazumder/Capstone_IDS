import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { Sidebar } from './layout/Sidebar';
import { TopBar } from './layout/TopBar';
import { MobileNav } from './layout/MobileNav';
import { useLiveStream } from './hooks/useLiveStream';

import Home from './pages/Home';
import Activity from './pages/Activity';
import AlertDetail from './pages/AlertDetail';
import Blocked from './pages/Blocked';
import Computer from './pages/Computer';
import { Reports } from './pages/Reports';
import { Health } from './pages/Health';
import { Learn } from './pages/Learn';
import { Settings } from './pages/Settings';
import { Demo } from './pages/Demo';
import { SplashScreen } from './components/SplashScreen';

export const ExpertContext = React.createContext<{ expert: boolean; setExpert: (v: boolean) => void }>({
  expert: false,
  setExpert: () => {},
});

const queryClient = new QueryClient();

export default function App() {
  const [expertMode, setExpertMode] = useState(() => {
    const saved = localStorage.getItem('sentinel_expert_mode');
    return saved === 'true';
  });
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    localStorage.setItem('sentinel_expert_mode', expertMode.toString());
  }, [expertMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ExpertContext.Provider value={{ expert: expertMode, setExpert: setExpertMode }}>
                {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <AppContent expertMode={expertMode} setExpertMode={setExpertMode} />
      </ExpertContext.Provider>
    </QueryClientProvider>
  );
}

function AppContent({
  expertMode,
  setExpertMode,
}: {
  expertMode: boolean;
  setExpertMode: (value: boolean) => void;
}) {
  const { state: liveState, notifications, unreadCount, markAllRead } = useLiveStream();

  return (
    <BrowserRouter>
        
      <div className="flex min-h-screen bg-[var(--color-background)] text-[#1A1A1A]">
        <Sidebar expertMode={expertMode} />
        
        <div className="flex-1 flex flex-col sm:ml-[80px] lg:ml-[260px] transition-all duration-300 min-h-screen pb-16 sm:pb-0">
          <TopBar 
            expertMode={expertMode} 
            setExpertMode={setExpertMode} 
            liveState={liveState}
            unreadCount={unreadCount}
            notifications={notifications}
            onMarkAllRead={markAllRead}
          />
          
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/activity/:source/:id" element={<AlertDetail />} />
              <Route path="/blocked" element={<Blocked />} />
              <Route path="/computer" element={<Computer />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/health" element={<Health />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/settings" element={<Settings />} />
              {expertMode && <Route path="/demo" element={<Demo />} />}
            </Routes>
          </main>
        </div>
        
        <MobileNav expertMode={expertMode} />
      </div>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
