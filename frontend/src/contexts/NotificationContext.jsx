import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: notification.type || 'info', // success, error, warning, info
      message: notification.message,
      duration: notification.duration || 5000, // Default 5 seconds
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const success = useCallback((message, duration = 5000) => {
    return addNotification({ type: 'success', message, duration });
  }, [addNotification]);

  const error = useCallback((message, duration = 5000) => {
    return addNotification({ type: 'error', message, duration });
  }, [addNotification]);

  const warning = useCallback((message, duration = 5000) => {
    return addNotification({ type: 'warning', message, duration });
  }, [addNotification]);

  const info = useCallback((message, duration = 5000) => {
    return addNotification({ type: 'info', message, duration });
  }, [addNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
