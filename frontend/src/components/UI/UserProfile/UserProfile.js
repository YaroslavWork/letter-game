import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import styles from './UserProfile.module.css';

export default function UserProfile({ user, onLogout }) {
  const { t } = useLanguage();
  if (!user) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return 'var(--accent-purple)';
    const colors = [
      'var(--accent-purple)',
      'var(--accent-blue)',
      'var(--accent-pink)',
      'var(--accent-orange)',
      'var(--primary)',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const gameName = user.game_name || user.username || t('userProfile.player');
  const initials = getInitials(gameName);
  const avatarColor = getAvatarColor(gameName);

  return (
    <div className={styles.userProfile}>
      <div className={styles.avatarContainer}>
        <div 
          className={styles.avatar}
          style={{ backgroundColor: avatarColor }}
        >
          <span className={styles.avatarText}>{initials}</span>
        </div>
      </div>
      <div className={styles.userInfo}>
        <h2 className={styles.userName}>{gameName}</h2>
        {user.email && (
          <p className={styles.userEmail}>{user.email}</p>
        )}
      </div>
      {onLogout && (
        <button 
          className={styles.logoutButton}
          onClick={onLogout}
          aria-label="Logout"
        >
          <span>{t('userProfile.logout')}</span>
        </button>
      )}
    </div>
  );
}
