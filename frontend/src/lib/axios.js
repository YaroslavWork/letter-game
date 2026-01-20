import Axios from 'axios';

// Get API URL from environment variable, default to localhost:8000 for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const axios = Axios.create({
  baseURL: API_BASE_URL,
});

axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 404) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const url = originalRequest.url || '';
            if (url.includes('/login/') || url.includes('/register/')) {
                return Promise.reject(error);
            }

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    const currentPath = window.location.pathname;
                    if (currentPath !== '/login' && currentPath !== '/register') {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        window.location.href = '/login';
                    }
                    return Promise.reject(error);
                }

                const refreshUrl = `${API_BASE_URL}/token/refresh/`;
                const response = await Axios.post(refreshUrl, {
                    refresh: refreshToken
                });

                const { access } = response.data;
                localStorage.setItem('access_token', access);
                
                originalRequest.headers.Authorization = `Bearer ${access}`;
                return axios(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);