import React from 'react';
import './Sidebar.css';

const Sidebar = ({ isDark, onThemeToggle, currentPage, onPageChange, onSyncEmails, onAddApplication, onViewEmails, onAutoSync, autoSyncing, autoSyncProgress }) => {
  return (
    <div className={`sidebar ${isDark ? 'dark' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-icon" 
             onClick={() => onPageChange('tracker')}
             title="Application Tracker"
             style={{ 
               backgroundColor: currentPage === 'tracker' ? (isDark ? '#3b82f6' : '#e0e7ff') : 'transparent',
               color: currentPage === 'tracker' ? (isDark ? '#fff' : '#3b82f6') : (isDark ? '#9ca3af' : '#6b7280')
             }}>
          📋
        </div>
        
        <div className="sidebar-icon" 
             onClick={() => onPageChange('resume-builder')}
             title="Resume Builder"
             style={{ 
               backgroundColor: currentPage === 'resume-builder' ? (isDark ? '#3b82f6' : '#e0e7ff') : 'transparent',
               color: currentPage === 'resume-builder' ? (isDark ? '#fff' : '#3b82f6') : (isDark ? '#9ca3af' : '#6b7280')
             }}>
          📄
        </div>
        
        <div className="sidebar-divider" />
        
        {onSyncEmails && (
          <div className="sidebar-icon" 
               onClick={onSyncEmails}
               title="Sync Emails"
               style={{
                 opacity: autoSyncing ? 0.5 : 1,
                 cursor: autoSyncing ? 'not-allowed' : 'pointer'
               }}>
            📧
          </div>
        )}
        
        {onAutoSync && (
          <div className="sidebar-icon" 
               onClick={onAutoSync}
               disabled={autoSyncing}
               title={autoSyncing ? `Auto Syncing ${autoSyncProgress?.current || 0}/${autoSyncProgress?.total || 0}...` : "Auto Sync"}
               style={{
                 opacity: autoSyncing ? 0.7 : 1,
                 cursor: autoSyncing ? 'not-allowed' : 'pointer',
                 backgroundColor: autoSyncing ? (isDark ? '#10b981' : '#d1fae5') : 'transparent',
                 color: autoSyncing ? (isDark ? '#fff' : '#059669') : (isDark ? '#9ca3af' : '#6b7280')
               }}>
            🔄
          </div>
        )}
        
        {onAddApplication && (
          <div className="sidebar-icon" 
               onClick={onAddApplication}
               title="Add Application">
            ➕
          </div>
        )}
        
        {onViewEmails && (
          <div className="sidebar-icon" 
               onClick={onViewEmails}
               title="View Emails">
            👁️
          </div>
        )}
        
      </div>
    </div>
  );
};

export default Sidebar;

