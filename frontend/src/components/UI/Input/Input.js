import styles from './Input.module.css';

export const Input = ({
  type,
  value,
  onChange,
  placeholder,
  hasError = false,
  error,
  name,
  size = 'medium',
  success = false,
  ...props
}) => {
  const inputClasses = [
    styles['input-control'],
    (hasError || error) ? styles['input-error'] : '',
    success ? styles['input-success'] : '',
    styles[size] || ''
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.inputWrapper}>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        className={inputClasses}
        onChange={onChange}
        {...props}
      />
      {error && <div className={styles['input-error-message']}>{error}</div>}
    </div>
  )
}