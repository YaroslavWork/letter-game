export const Input = ({type, value, onChange, placeholder, hasError = false, error, name, ...props}) => {
    return (
        <>
            <input
                type={type}
                name={name}
                value={value}
                placeholder={placeholder}
                className={`input-control ${(hasError || error) ? 'input-error': ''}`}
                onChange={onChange}
                {...props}
            />
            {error && <div className="input-error-message">{error}</div>}
        </>
    )
}