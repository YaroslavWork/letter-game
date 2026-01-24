import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MenuBar.module.css';

export default function MenuBar({ onHostClick, onJoinClick }) {
  const navigate = useNavigate();

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
        <span className={styles.menuIcon}>🏠</span>
        <span className={styles.menuText}>Host Game</span>
      </button>
      <button 
        className={`${styles.menuItem} ${styles.joinItem}`}
        onClick={handleJoin}
      >
        <span className={styles.menuIcon}>🎮</span>
        <span className={styles.menuText}>Join Game</span>
      </button>
    </div>
  );
}
