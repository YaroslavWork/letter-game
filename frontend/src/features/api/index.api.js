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

// Game session APIs
export const getGameTypes = () => axios.get('/game-types/');
export const getGameSession = (roomId) => axios.get(`/rooms/${roomId}/game-session/`);
export const updateGameSession = (roomId, data) => axios.put(`/rooms/${roomId}/game-session/update/`, data);
export const startGameSession = (roomId) => axios.post(`/rooms/${roomId}/game-session/start/`);
export const submitAnswer = (roomId, data) => axios.post(`/rooms/${roomId}/game-session/submit/`, data);
export const getPlayerScores = (roomId, includeTotals = false) => {
  const params = includeTotals ? { include_totals: 'true' } : {};
  return axios.get(`/rooms/${roomId}/game-session/scores/`, { params });
};
export const advanceRound = (roomId) => axios.post(`/rooms/${roomId}/game-session/advance-round/`);