import React, { useState, useEffect } from 'react';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Show splash for 1.5 seconds before fading out
    const fadeTimer = setTimeout(() => setIsFading(true), 1500);
    // Unmount after fade finishes (700ms transition duration)
    const unmountTimer = setTimeout(onFinish, 2200);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-[var(--color-background)] flex items-center justify-center p-4 sm:p-8 transition-opacity duration-700 ease-in-out ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <div className="bg-dark text-white rounded-[2rem] w-full max-w-6xl px-6 py-20 md:py-32 text-center shadow-2xl relative overflow-hidden border border-[#2C2C2C] animate-in zoom-in-95 duration-700">
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight mb-10">
            Every digital threat starts with a connection.<br />
            Trust SentinelAI to block it,<br />
            so you can <span className="italic text-accent-pink font-serif">focus on what comes next.</span>
          </h1>
          <p className="text-sage text-sm md:text-base font-semibold tracking-[0.2em] uppercase">
            SENTINEL AI SECURING YOUR WORKFLOW
          </p>
        </div>
        
        {/* Decorative forest green shape mimicking Wispr Flow */}
        <div className="absolute -bottom-[50%] sm:-bottom-[70%] left-1/2 -translate-x-1/2 w-[150%] h-full bg-forest rounded-[100%] z-0 shadow-[inset_0_10px_30px_rgba(0,0,0,0.5)]"></div>
      </div>
    </div>
  );
}