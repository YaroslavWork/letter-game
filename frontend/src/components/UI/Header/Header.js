import React from 'react'
import styles from './Header.module.css'

export default function Header({ text }) {
    return (
        <h1 className={styles.header}>{text}</h1>
    )
}