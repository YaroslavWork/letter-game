import React, { useState, useEffect } from 'react'
import { useMutationLoginData } from '../../features/hooks/index.hooks';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Input } from '../../components/UI/Input/Input';
import Button from '../../components/UI/Button/Button';
import Header from '../../components/UI/Header/Header';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginPage.module.css';

const initialState = {
  username: '',
  password: '',
};

export default function LoginPage() {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const { error: showError } = useNotification();
  const { t } = useLanguage();
  const { mutate, isPending, isError, error: apiError } = useMutationLoginData();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isAuthenticated) {
    return null;
  }

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

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username) newErrors.username = t('login.usernameRequired');
    if (!formData.password) newErrors.password = t('login.passwordRequired');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErrors({});

    if (validateForm()) {
      mutate(formData, {
        onSuccess: (response) => {
          try {
            const responseData = response?.data || response;
            
            if (!responseData || !responseData.access || !responseData.refresh) {
              showError(t('login.invalidResponse'));
              return;
            }

            const { access, refresh, user: userData } = responseData;
            login(access, refresh, userData);
            
            navigate('/');
          } catch (error) {
            showError(t('login.errorProcessing'));
          }
        },
        onError: (error) => {
          if (error.response?.status === 401) {
            setErrors({ 
              password: t('login.incorrectPassword'),
              username: t('login.incorrectUsername')
            });
          } else if (error.response?.status === 400) {
            const errorData = error.response?.data;
            setErrors({
              username: errorData?.username?.[0] || errorData?.non_field_errors?.[0] || t('login.invalidUsername'),
              password: errorData?.password?.[0] || t('login.invalidPassword')
            });
          } else {
            const errorMessage = error.response?.data?.detail || error.response?.data?.message || t('login.loginFailed');
            setErrors({
              username: errorMessage,
              password: errorMessage
            });
            // Also show notification for non-field-specific errors
            if (!error.response?.data?.username && !error.response?.data?.password) {
              showError(errorMessage);
            }
          }
        }
      })
    }
    
    return false;
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      <form onSubmit={handleSubmit} noValidate className={styles.form} action="#" method="post">
        <Header text={t('login.welcome')} />

        <Input 
          type="text" 
          name="username" 
          value={formData.username} 
          onChange={handleChange} 
          placeholder={t('login.usernamePlaceholder')}
          error={errors.username} 
        />

        <Input 
          type="password" 
          name="password" 
          value={formData.password} 
          onChange={handleChange} 
          placeholder={t('login.passwordPlaceholder')}
          error={errors.password} 
        />

        <Button 
          type="submit" 
          disabled={isPending}
          variant="playful"
          fullWidth
        >
          {isPending ? t('login.loggingIn') : t('login.login')}
        </Button>

        <div className={styles.registerLink}>
          <Link to="/register">
            {t('login.noAccount')}
          </Link>
        </div>
      </form>
    </div>
  )
}
