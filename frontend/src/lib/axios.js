import Axios from 'axios';

export const axios = Axios.create({
  baseURL: 'http://localhost:8000/api',
});

axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token')

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
    (response) => response,
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

                const response = await Axios.post('/token/refresh/', {
                    refresh: refreshToken
                }, {
                    baseURL: 'http://localhost:8000/api'
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