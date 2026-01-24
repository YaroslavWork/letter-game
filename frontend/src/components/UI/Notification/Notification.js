import React from 'react';
import styles from './Notification.module.css';

export default function Notification({ notification, onClose }) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.notification} ${styles[notification.type]}`}>
      <div className={styles.notificationContent}>
        <span className={styles.icon}>{getIcon()}</span>
        <span className={styles.message}>{notification.message}</span>
        <button
          className={styles.closeButton}
          onClick={() => onClose(notification.id)}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
