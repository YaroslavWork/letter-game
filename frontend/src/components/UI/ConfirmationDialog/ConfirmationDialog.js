import React from 'react';
import { useConfirmation } from '../../../contexts/ConfirmationContext';
import Button from '../Button/Button';
import styles from './ConfirmationDialog.module.css';

export default function ConfirmationDialog() {
  const { confirmations, resolveConfirmation } = useConfirmation();

  if (confirmations.length === 0) {
    return null;
  }

  // Show the most recent confirmation (last in array)
  const confirmation = confirmations[confirmations.length - 1];

  const handleConfirm = () => {
    resolveConfirmation(confirmation.id, true);
  };

  const handleCancel = () => {
    resolveConfirmation(confirmation.id, false);
  };

  const getConfirmButtonClass = () => {
    switch (confirmation.confirmButtonStyle) {
      case 'danger':
        return styles.confirmButtonDanger;
      case 'success':
        return styles.confirmButtonSuccess;
      case 'warning':
        return styles.confirmButtonWarning;
      default:
        return styles.confirmButtonPrimary;
    }
  };

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{confirmation.title}</h3>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{confirmation.message}</p>
        </div>
        <div className={styles.footer}>
          <Button
            onButtonClick={handleCancel}
            className={styles.cancelButton}
          >
            {confirmation.cancelText}
          </Button>
          <Button
            onButtonClick={handleConfirm}
            className={`${styles.confirmButton} ${getConfirmButtonClass()}`}
          >
            {confirmation.confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
