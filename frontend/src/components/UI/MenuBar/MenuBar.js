import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../contexts/LanguageContext';
import styles from './MenuBar.module.css';

export default function MenuBar({ onHostClick, onJoinClick }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleHost = () => {
    if (onHostClick) {
      onHostClick();
    } else {
      navigate('/host');
    }
  };

  const handleJoin = () => {
    if (onJoinClick) {
      onJoinClick();
    } else {
      navigate('/join');
    }
  };

  return (
    <div className={styles.menuBar}>
      <button 
        className={`${styles.menuItem} ${styles.hostItem}`}
        onClick={handleHost}
      >
        <span className={styles.menuText}>{t('menu.hostGame')}</span>
      </button>
      <button 
        className={`${styles.menuItem} ${styles.joinItem}`}
        onClick={handleJoin}
      >
        <span className={styles.menuText}>{t('menu.joinGame')}</span>
      </button>
    </div>
  );
}
