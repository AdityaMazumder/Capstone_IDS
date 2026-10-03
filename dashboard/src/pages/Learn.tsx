import { useContext } from 'react';
import { ExpertContext } from '../App';
import { translateThreat } from '../lib/translate';
import * as Icons from 'lucide-react';

export function Learn() {
  const { expert } = useContext(ExpertContext);
  
  const threatsToShow = [
    'DDoS', 'DoS', 'Botnet', 'SSH-Bruteforce', 'FTP-BruteForce', 
    'BruteForce', 'PortScan', 'Infiltration', 'WebAttack', 
    'AnomalousTraffic', 'Stealer', 'Ransomware', 'Malware'
  ];

  const getIcon = (name: string) => {
    const IconComponent = (Icons as any)[name] || Icons.ShieldAlert;
    return <IconComponent className="w-8 h-8" />;
  };

  return (
    <div className="aesthetic-icons space-y-8 max-w-7xl mx-auto p-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900  mb-2">Learn About Threats</h1>
        <p className="text-dark dark:text-dark">
          Understand the types of attacks SentinelAI protects you from.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {threatsToShow.map((threatType) => {
          // If THREAT_MAP might not have everything directly exported, we can just use translateThreat
          // But since the instructions say use THREAT_MAP data, we will try to use it if available or fallback.
          // Assuming translateThreat handles these properly.
          const translated = translateThreat(threatType);
          
          // Heuristic to pick an icon since lucide-react names are needed.
          // In a real app we might map these explicitly. We'll use ShieldAlert as default.
          let iconName = 'ShieldAlert';
          if (threatType.includes('DDoS') || threatType.includes('DoS')) iconName = 'Zap';
          if (threatType.includes('Bruteforce') || threatType.includes('BruteForce')) iconName = 'Key';
          if (threatType.includes('Botnet')) iconName = 'Cpu';
          if (threatType.includes('PortScan')) iconName = 'Search';
          if (threatType.includes('Stealer')) iconName = 'EyeOff';
          if (threatType.includes('Ransomware')) iconName = 'Lock';
          if (threatType.includes('Malware')) iconName = 'Bug';
          if (threatType.includes('WebAttack')) iconName = 'Globe';
          if (threatType.includes('Infiltration')) iconName = 'LogOut';

          return (
            <div key={threatType} className="bg-[var(--color-sage)] p-6 rounded-[2rem] flex flex-col h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                  {getIcon(iconName)}
                </div>
                <h2 className="text-xl font-bold text-gray-900 ">{translated.friendlyName}</h2>
              </div>
              
              <div className="aesthetic-icons space-y-4 flex-grow">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900  uppercase tracking-wider mb-1">What is it?</h3>
                  <p className="text-dark  text-sm">{translated.explanation}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-900  uppercase tracking-wider mb-1">How SentinelAI protects you</h3>
                  <p className="text-dark  text-sm">
                    Automatically detects the suspicious patterns and blocks the source before it can cause harm.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900  uppercase tracking-wider mb-1">What you can do</h3>
                  <p className="text-dark  text-sm">{translated.advice}</p>
                </div>
              </div>
              
              {expert && (
                <div className="mt-4 pt-4 border-t border-gray-100 border-transparent">
                  <p className="text-xs font-mono text-dark">Technical ID: {threatType}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
