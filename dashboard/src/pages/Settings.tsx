import React, { useContext, useEffect, useState } from 'react';
import { ExpertContext } from '../App';
import { Bell, Shield, Settings2 } from 'lucide-react';

export function Settings() {
  const { expert, setExpert } = useContext(ExpertContext);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('sentinel_sound') !== 'false');
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');

  useEffect(() => {
    localStorage.setItem('sentinel_sound', String(soundEnabled));
  }, [soundEnabled]);

  const handleNotificationRequest = async () => {
    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
    } else {
      setNotificationsEnabled(false);
    }
  };

  return (
    <div className="aesthetic-icons space-y-6 max-w-3xl mx-auto p-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
        <p className="text-dark">
          Customize your SentinelAI experience.
        </p>
      </div>

      <div className="bg-[var(--color-sage)] rounded-[2rem] divide-y divide-gray-200">
        
        {/* View Mode */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg self-start">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900">Expert Mode</h3>
              <p className="text-sm text-dark">
                Show detailed technical information, raw JSON data, and advanced controls.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={expert} onChange={(e) => setExpert(e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Sound */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg self-start">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900">Sound Alerts</h3>
              <p className="text-sm text-dark">
                Play a sound when a critical security event is detected.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Browser Notifications */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg self-start">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900">Browser Notifications</h3>
              <p className="text-sm text-dark">
                Receive popup notifications from your browser for important events.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={notificationsEnabled} onChange={handleNotificationRequest} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

      </div>
    </div>
  );
}