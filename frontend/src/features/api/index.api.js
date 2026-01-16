import { axios } from "../../lib/axios";

export const getMeData = () => axios.get(`/me`);

export const registerUser = (data) => axios.post('/register/', data);
export const loginUser = (credentials) => axios.post('/login/', credentials);

export const createRoom = (data) => axios.post('/rooms/create/', data);
export const joinRoom = (roomId) => axios.post('/rooms/join/', { room_id: roomId });
export const getRoom = (roomId) => axios.get(`/rooms/${roomId}/`);
export const leaveRoom = (roomId) => axios.post(`/rooms/${roomId}/leave/`);
export const deleteRoom = (roomId) => axios.delete(`/rooms/${roomId}/delete/`);
export const deletePlayer = (roomId, playerId) => axios.delete(`/rooms/${roomId}/players/${playerId}/delete/`);