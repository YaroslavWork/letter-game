import React from 'react'
import styles from './Button.module.css'

export default function Button({ 
  children, 
  onButtonClick, 
  disabled = false, 
  type = 'button',
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  ...props 
}) {
  const buttonClasses = [
    styles.button,
    styles[variant] || styles.primary,
    styles[size] || '',
    fullWidth ? styles.fullWidth : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      disabled={disabled}
      className={buttonClasses}
      onClick={onButtonClick}
      {...props}
    >
      {children}
    </button>
  )
}