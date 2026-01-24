import React from 'react';
import Button from '../Button/Button';
import styles from './ReconnectNotification.module.css';

export default function ReconnectNotification({ 
  onReconnect, 
  onClose, 
  isReconnecting = false 
}) {
  return (
    <div className={styles.reconnectNotification}>
      <button 
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className={styles.content}>
        <div className={styles.icon}>🔗</div>
        <div className={styles.text}>
          <h3 className={styles.title}>Active Room Session</h3>
          <p className={styles.message}>You have an active room session</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button
          onButtonClick={onReconnect}
          disabled={isReconnecting}
          variant="playful"
          size="small"
        >
          {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
        </Button>
      </div>
    </div>
  );
}
