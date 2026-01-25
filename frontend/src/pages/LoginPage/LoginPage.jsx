import React, { useState, useEffect } from 'react'
import { useMutationLoginData } from '../../features/hooks/index.hooks';
import { useNotification } from '../../contexts/NotificationContext';
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
    if (!formData.username) newErrors.username = "Username or email is required";
    if (!formData.password) newErrors.password = 'Password is required';

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
              showError('Invalid response from server. Please try again.');
              return;
            }

            const { access, refresh, user: userData } = responseData;
            login(access, refresh, userData);
            
            navigate('/');
          } catch (error) {
            showError('Error processing login response. Please try again.');
          }
        },
        onError: (error) => {
          if (error.response?.status === 401) {
            setErrors({ 
              password: 'Incorrect password',
              username: 'Incorrect username or email'
            });
          } else if (error.response?.status === 400) {
            const errorData = error.response?.data;
            setErrors({
              username: errorData?.username?.[0] || errorData?.non_field_errors?.[0] || 'Invalid username or email',
              password: errorData?.password?.[0] || 'Invalid password'
            });
          } else {
            const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Login failed. Please try again.';
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
        <Header text={"Welcome Back!"} />

        <Input 
          type="text" 
          name="username" 
          value={formData.username} 
          onChange={handleChange} 
          placeholder="Username or Email"
          error={errors.username} 
        />

        <Input 
          type="password" 
          name="password" 
          value={formData.password} 
          onChange={handleChange} 
          placeholder="Password"
          error={errors.password} 
        />

        <Button 
          type="submit" 
          disabled={isPending}
          variant="playful"
          fullWidth
        >
          {isPending ? 'Logging in...' : 'Login'}
        </Button>

        <div className={styles.registerLink}>
          <Link to="/register">
            Don't have an account? Register here
          </Link>
        </div>
      </form>
    </div>
  )
}
