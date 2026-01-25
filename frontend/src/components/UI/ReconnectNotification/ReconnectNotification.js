import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import Button from '../Button/Button';
import styles from './ReconnectNotification.module.css';

export default function ReconnectNotification({ 
  onReconnect, 
  onClose, 
  isReconnecting = false 
}) {
  const { t } = useLanguage();
  
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
          <h3 className={styles.title}>{t('reconnect.activeRoomSession')}</h3>
          <p className={styles.message}>{t('reconnect.activeRoomMessage')}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button
          onButtonClick={onReconnect}
          disabled={isReconnecting}
          variant="playful"
          size="small"
        >
          {isReconnecting ? t('reconnect.reconnecting') : t('reconnect.reconnect')}
        </Button>
      </div>
    </div>
  );
}
