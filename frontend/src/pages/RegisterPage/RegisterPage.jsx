import React, { useState } from 'react'
import { useMutationRegisterData } from '../../features/hooks/index.hooks';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Input } from '../../components/UI/Input/Input';
import Button from '../../components/UI/Button/Button';
import Header from '../../components/UI/Header/Header';
import { useNavigate, Link } from 'react-router-dom';
import styles from './RegisterPage.module.css';

const initialState = {
  username: '',
  game_name: '',
  email: '',
  password: '',
  repeatPassword: '',
};

export default function RegisterPage() {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotification();
  const { t } = useLanguage();

  const { mutate, isPending, isError, error: apiError } = useMutationRegisterData();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  }

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username) newErrors.username = t('register.usernameRequired');
    if (!formData.game_name) newErrors.game_name = t('register.gameNameRequired');
    if (!formData.email) {
      newErrors.email = t('register.emailRequired');
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = t('register.invalidEmail');
    }
    if (!formData.password) {
      newErrors.password = t('register.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('register.passwordMinLength');
    }
    if (formData.password !== formData.repeatPassword) {
      newErrors.repeatPassword = t('register.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      const { repeatPassword, ...rest } = formData;
      const apiData = {
        ...rest,
      };

      mutate(apiData, {
        onSuccess: () => {
          showSuccess(t('register.registrationSuccessful'))
          setFormData(initialState);
          navigate('/login');
        },
        onError: (error) => {
          const errorData = error.response?.data;
          const newErrors = {};
          
          if (error.response?.status === 400) {
            if (errorData?.username) {
              newErrors.username = Array.isArray(errorData.username) 
                ? errorData.username[0] 
                : errorData.username;
            }
            if (errorData?.email) {
              newErrors.email = Array.isArray(errorData.email) 
                ? errorData.email[0] 
                : errorData.email;
            }
            if (errorData?.password) {
              newErrors.password = Array.isArray(errorData.password) 
                ? errorData.password[0] 
                : errorData.password;
            }
            if (errorData?.non_field_errors) {
              newErrors.username = Array.isArray(errorData.non_field_errors) 
                ? errorData.non_field_errors[0] 
                : errorData.non_field_errors;
            }
          } else {
            const errorMessage = errorData?.detail || errorData?.message || error.message || t('register.registrationFailed');
            newErrors.username = errorMessage;
            // Show notification for non-field-specific errors
            if (!errorData?.username && !errorData?.email && !errorData?.password && !errorData?.non_field_errors) {
              showError(errorMessage);
            }
          }
          
          setErrors(newErrors);
        }
      })
    }
  }

  return (
    <div className={styles.registerPage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      <div className={styles.decorativeCircle3}></div>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        <Header text={t('register.joinFun')} />

        <Input 
          type="text" 
          name="username" 
          value={formData.username} 
          onChange={handleChange} 
          placeholder={t('register.usernamePlaceholder')} 
          error={errors.username} 
        />

        <Input 
          type="text" 
          name="game_name" 
          value={formData.game_name} 
          onChange={handleChange} 
          placeholder={t('register.gameNamePlaceholder')} 
          error={errors.game_name} 
        />

        <Input 
          type="email" 
          name="email" 
          value={formData.email} 
          onChange={handleChange} 
          placeholder={t('register.emailPlaceholder')} 
          error={errors.email} 
        />

        <Input 
          type="password" 
          name="password" 
          value={formData.password} 
          onChange={handleChange} 
          placeholder={t('register.passwordPlaceholder')} 
          error={errors.password} 
        />

        <Input 
          type="password" 
          name="repeatPassword" 
          value={formData.repeatPassword} 
          onChange={handleChange} 
          placeholder={t('register.repeatPasswordPlaceholder')} 
          error={errors.repeatPassword} 
        />

        <Button 
          type="submit" 
          disabled={isPending}
          variant="playful"
          fullWidth
        >
          {isPending ? t('register.registering') : t('register.createAccount')}
        </Button>

        <div className={styles.loginLink}>
          <Link to="/login">
            {t('register.alreadyHaveAccount')}
          </Link>
        </div>
      </form>
    </div>
  )
}
