import React from 'react'
import styles from './Header.module.css'

export default function Header({ text, variant = 'default' }) {
    const headerClasses = [
        styles.header,
        variant === 'playful' ? styles.playful : ''
    ].filter(Boolean).join(' ');

    return (
        <h1 className={headerClasses}>{text}</h1>
    )
}