import React from 'react';
import { useNotification } from '../../../contexts/NotificationContext';
import Notification from './Notification';
import styles from './NotificationContainer.module.css';

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
}
