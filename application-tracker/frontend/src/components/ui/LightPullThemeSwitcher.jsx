import { motion } from "motion/react";
import { useEffect } from "react";

export function LightPullThemeSwitcher({ isDark, onThemeToggle }) {
  // Sync component with current theme state
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    const newTheme = !isDark;
    const root = document.documentElement;
    
    if (newTheme) {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark");
    }
    
    if (onThemeToggle) {
      onThemeToggle(newTheme);
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        zIndex: 10000,
        pointerEvents: 'auto',
        width: '40px',
        height: '150px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        background: 'transparent'
      }}
    >
      <motion.div
        drag="y"
        dragDirectionLock
        onDragEnd={(event, info) => {
          if (info.offset.y > 10) {
            toggleDarkMode();
          }
        }}
        dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 15 }}
        dragElastic={0.075}
        whileDrag={{ cursor: "grabbing" }}
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          cursor: 'grab',
          background: isDark 
            ? 'radial-gradient(circle at center, #6b7280, #4b5563, #1f2937)'
            : 'radial-gradient(circle at center, #facc15, #fcd34d, #fef9c3)',
          boxShadow: isDark
            ? '0 0 25px 10px rgba(107, 114, 128, 0.8), 0 0 15px 5px rgba(75, 85, 99, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.1)'
            : '0 0 25px 10px rgba(250, 204, 21, 0.6), 0 0 15px 5px rgba(252, 211, 77, 0.4)',
          flexShrink: 0,
          zIndex: 10001,
          border: isDark ? '2px solid rgba(107, 114, 128, 0.5)' : '2px solid rgba(250, 204, 21, 0.3)'
        }}
      >
        <div 
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '2px',
            height: '120px',
            background: isDark ? 'linear-gradient(to top, #6b7280, #4b5563, transparent)' : 'linear-gradient(to top, #e5e7eb, #cbd5e1, transparent)',
            zIndex: 10000,
            boxShadow: isDark ? '0 0 5px rgba(107, 114, 128, 0.5)' : '0 0 3px rgba(229, 231, 235, 0.3)'
          }}
        ></div>
      </motion.div>
    </div>
  );
}

export default LightPullThemeSwitcher;
