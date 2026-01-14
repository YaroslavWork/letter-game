import React from 'react'
import styles from './Button.module.css'

export default function Button( {children, onButtonClick, disabled = false, type = 'button', ...props} ) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="button"
      onClick={onButtonClick}
      {...props}
    >
      {children}
    </button>
  )
}