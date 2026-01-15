import React, { useState } from 'react'
import { useMutationRegisterData } from '../../features/hooks/index.hooks';
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
    if (!formData.username) newErrors.username = "Username is required";
    if (!formData.game_name) newErrors.game_name = "Game name is required";
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.repeatPassword) {
      newErrors.repeatPassword = 'Passwords do not match';
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
          console.log('Registration successful!');
          alert('Registration successful! Please log in.')
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
            const errorMessage = errorData?.detail || errorData?.message || error.message || 'Registration failed. Please try again.';
            newErrors.username = errorMessage;
          }
          
          setErrors(newErrors);
        }
      })
    }
  }

  return (
    <div className={styles.registerPage}>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        <Header text={"Create Account"} />

        <Input 
          type="text" 
          name="username" 
          value={formData.username} 
          onChange={handleChange} 
          placeholder="Username" 
          error={errors.username} 
        />
        <Input 
          type="text" 
          name="game_name" 
          value={formData.game_name} 
          onChange={handleChange} 
          placeholder="Game Name" 
          error={errors.game_name} 
        />
        <Input 
          type="email" 
          name="email" 
          value={formData.email} 
          onChange={handleChange} 
          placeholder="Email" 
          error={errors.email} 
        />
        <Input 
          type="password" 
          name="password" 
          value={formData.password} 
          onChange={handleChange} 
          placeholder="Password" 
          error={errors.password} 
        />
        <Input 
          type="password" 
          name="repeatPassword" 
          value={formData.repeatPassword} 
          onChange={handleChange} 
          placeholder="Repeat Password" 
          error={errors.repeatPassword} 
        />
      
        {isError && (
          <div className="api-error">
            {apiError?.response?.data?.username?.[0] || 
             apiError?.response?.data?.email?.[0] || 
             apiError?.response?.data?.password?.[0] ||
             apiError?.response?.data?.non_field_errors?.[0] ||
             apiError?.response?.data?.message || 
             apiError?.message || 
             'Failed to register. Please check your information.'}
          </div>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Registering...' : 'Register'}
        </Button>

        <div className={styles.loginLink}>
          <Link to="/login">
            Already have an account? Login here
          </Link>
        </div>
      </form>
    </div>
  )
}
