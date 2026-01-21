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

// Room hooks
export const useRoom = (roomId) => {
  return useQuery({
    queryKey: ['room', roomId],
    queryFn: () => api.getRoom(roomId),
    enabled: !!roomId,
  });
};

export const useMutationCreateRoom = () => {
  return useMutation({
    mutationFn: (data) => api.createRoom(data),
  });
};

export const useMutationJoinRoom = () => {
  return useMutation({
    mutationFn: (roomId) => api.joinRoom(roomId),
  });
};

export const useMutationLeaveRoom = () => {
  return useMutation({
    mutationFn: (roomId) => api.leaveRoom(roomId),
  });
};

export const useMutationDeleteRoom = () => {
  return useMutation({
    mutationFn: (roomId) => api.deleteRoom(roomId),
  });
};

export const useMutationDeletePlayer = () => {
  return useMutation({
    mutationFn: ({ roomId, playerId }) => api.deletePlayer(roomId, playerId),
  });
};

// Game session hooks
export const useGameTypes = () => {
  return useQuery({
    queryKey: ['gameTypes'],
    queryFn: () => api.getGameTypes(),
  });
};

export const useGameSession = (roomId) => {
  return useQuery({
    queryKey: ['gameSession', roomId],
    queryFn: () => api.getGameSession(roomId),
    enabled: !!roomId,
  });
};

export const useMutationUpdateGameSession = () => {
  return useMutation({
    mutationFn: ({ roomId, data }) => api.updateGameSession(roomId, data),
  });
};

export const useMutationStartGameSession = () => {
  return useMutation({
    mutationFn: (roomId) => api.startGameSession(roomId),
  });
};

export const useMutationSubmitAnswer = () => {
  return useMutation({
    mutationFn: ({ roomId, data }) => api.submitAnswer(roomId, data),
  });
};

export const usePlayerScores = (roomId, includeTotals = false) => {
  return useQuery({
    queryKey: ['playerScores', roomId, includeTotals],
    queryFn: () => api.getPlayerScores(roomId, includeTotals),
    enabled: !!roomId,
  });
};

export const useMutationAdvanceRound = () => {
  return useMutation({
    mutationFn: (roomId) => api.advanceRound(roomId),
  });
};
