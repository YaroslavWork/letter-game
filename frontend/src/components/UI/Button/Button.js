import React from 'react'
import styles from './Button.module.css'

export default function Button( {text, onButtonClick} ) {
  return (
    <button
      onClick={onButtonClick}
    >
      {text}
    </button>
  )
}