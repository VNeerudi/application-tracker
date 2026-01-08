import React from 'react';
import './LightSwitch.css';

const LightSwitch = ({ isDark, onToggle }) => {
  return (
    <div className="light-switch-container">
      <div className="light-switch-plate">
        <button
          className={`light-switch-toggle ${isDark ? 'on' : 'off'}`}
          onClick={() => onToggle(!isDark)}
          aria-label="Toggle theme"
        >
          <div className="light-switch-toggle-inner"></div>
        </button>
      </div>
    </div>
  );
};

export default LightSwitch;







