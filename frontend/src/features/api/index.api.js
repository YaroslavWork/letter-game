import { axios } from "../../lib/axios";

export const getMeData = () => axios.get(`/me`);

export const registerUser = (data) => axios.post('/register/', data);
export const loginUser = (credentials) => axios.post('/login/', credentials);