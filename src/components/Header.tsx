import React, { useState } from 'react';
import './Header.css';

interface User {
  username: string;
  name: string;
  tenant_id: string;
  is_admin: boolean;
  roles?: string[];
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onShowAdmin: () => void;
  showingAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onShowAdmin, showingAdmin }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Guard clause - don't render if user is null
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    onLogout();
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1>VisualizeHR - Agentic AI Orchestration</h1>
          <p>Secure Container • Memory-Enhanced • Voice & Text Interface</p>
        </div>

        <div className="header-right">
          <div className="nav-buttons">
            <button
              className={`nav-button ${showingAdmin ? 'active' : ''}`}
              onClick={onShowAdmin}
              disabled={!user.is_admin}
              title={user.is_admin ? 'Admin Dashboard' : 'Admin access required'}
            >
              🛠️ {showingAdmin ? 'Back to Agents' : 'Admin Dashboard'}
            </button>

            <div className="user-menu">
              <button 
                className="user-button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-tenant">{user.tenant_id}</span>
                </div>
                <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="user-details">
                      <div className="detail-row">
                        <span className="label">Username:</span>
                        <span className="value">{user.username}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Tenant:</span>
                        <span className="value">{user.tenant_id}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Admin:</span>
                        <span className="value">
                          {user.is_admin ? (
                            <span className="badge admin">✓ Yes</span>
                          ) : (
                            <span className="badge user">✗ No</span>
                          )}
                        </span>
                      </div>
                      {user.roles && user.roles.length > 0 && (
                        <div className="detail-row">
                          <span className="label">Roles:</span>
                          <div className="roles-list">
                            {user.roles.map((role, index) => (
                              <span key={index} className="role-badge">{role}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="dropdown-footer">
                    <button 
                      className="logout-button"
                      onClick={handleLogout}
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
