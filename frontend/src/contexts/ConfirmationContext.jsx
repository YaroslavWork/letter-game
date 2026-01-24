import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmationContext = createContext(null);

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
};

export const ConfirmationProvider = ({ children }) => {
  const [confirmations, setConfirmations] = useState([]);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const id = Date.now() + Math.random();
      const confirmation = {
        id,
        title: options.title || 'Confirm',
        message: options.message || 'Are you sure?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmButtonStyle: options.confirmButtonStyle || 'danger', // danger, primary, success, etc.
        resolve,
      };

      setConfirmations((prev) => [...prev, confirmation]);
    });
  }, []);

  const resolveConfirmation = useCallback((id, confirmed) => {
    setConfirmations((prev) => {
      const confirmation = prev.find((c) => c.id === id);
      if (confirmation) {
        confirmation.resolve(confirmed);
      }
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const value = {
    confirmations,
    confirm,
    resolveConfirmation,
  };

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
    </ConfirmationContext.Provider>
  );
};
