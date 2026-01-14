import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '../api/index.api';

export const useMeData = () => {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMeData(),
  });
};

export const useMutationRegisterData = () => {
  return useMutation({
    mutationFn: (data) => api.registerUser(data),
  });
};

export const useMutationLoginData = () => {
  return useMutation({
    mutationFn: (credentials) => api.loginUser(credentials),
  });
};
