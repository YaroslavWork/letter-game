import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom, useGameTypes, useGameSession, useMutationUpdateGameSession } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import { Input } from '../../components/UI/Input/Input';
import styles from './HostGameRulePage.module.css';

export default function HostGameRulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { roomId } = useParams();
  const [letter, setLetter] = useState('');
  const [isRandomLetter, setIsRandomLetter] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [error, setError] = useState('');

  const { data: roomData, isLoading: isLoadingRoom } = useRoom(roomId);
  const { data: gameTypesData, isLoading: isLoadingTypes } = useGameTypes();
  const { data: gameSessionData, isLoading: isLoadingSession, refetch: refetchGameSession } = useGameSession(roomId);
  const updateGameSessionMutation = useMutationUpdateGameSession();

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      // Update game session from room data only if it actually changed
      // This prevents the letter from changing when players join/leave
      if (data.data?.game_session) {
        const session = data.data.game_session;
        // Only update if the game session configuration actually changed
        // Don't update letter if it's random (final_letter will be null/undefined)
        // Only update letter if it's a specific letter that changed
        if (!session.is_random_letter && session.letter) {
          setLetter(session.letter || '');
        }
        setIsRandomLetter(session.is_random_letter);
        setSelectedTypes(session.selected_types || []);
      }
    } else if (data.type === 'room_deleted_notification') {
      // Room was deleted by host
      alert('The room has been deleted.');
      wsClient.disconnect();
      // Clear stored room info
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    wsClient.on('message', handleWebSocketMessage);
    
    return () => {
      wsClient.off('message', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage]);

  // Load game session data when available
  useEffect(() => {
    if (gameSessionData) {
      const session = gameSessionData?.data || gameSessionData;
      if (session) {
        // Only set letter if it's a specific letter (not random)
        // This prevents the letter from changing unnecessarily
        if (!session.is_random_letter && session.letter) {
          setLetter(session.letter || '');
        } else if (session.is_random_letter) {
          // Clear letter if switching to random
          setLetter('');
        }
        setIsRandomLetter(session.is_random_letter);
        setSelectedTypes(session.selected_types || []);
      }
    }
  }, [gameSessionData]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Check if user is host
    if (roomData && !isLoadingRoom) {
      const room = roomData?.data || roomData;
      if (room && room.host_id !== user?.id) {
        navigate('/');
        return;
      }
      
      // Connect to WebSocket if not already connected
      if (room && room.id && (!wsClient.isConnected() && wsClient.getState() !== 'CONNECTING')) {
        const token = localStorage.getItem('access_token');
        if (token) {
          wsClient.connect(room.id, token);
        }
      }
    }
  }, [isAuthenticated, navigate, roomData, isLoadingRoom, user]);

  const handleLetterChange = (e) => {
    const value = e.target.value.toUpperCase().trim();
    // Only allow single letter
    if (value.length <= 1) {
      setLetter(value);
      if (value.length === 1) {
        setIsRandomLetter(false);
      }
    }
  };

  const handleRandomLetterToggle = () => {
    setIsRandomLetter(!isRandomLetter);
    if (!isRandomLetter) {
      setLetter('');
    }
  };

  const handleTypeToggle = (typeKey) => {
    setSelectedTypes(prev => {
      if (prev.includes(typeKey)) {
        return prev.filter(t => t !== typeKey);
      } else {
        return [...prev, typeKey];
      }
    });
  };

  const handleSave = () => {
    setError('');

    if (!isRandomLetter && !letter) {
      setError('Please enter a letter or select random letter');
      return;
    }

    if (selectedTypes.length === 0) {
      setError('Please select at least one game type');
      return;
    }

    const updateData = {
      is_random_letter: isRandomLetter,
      selected_types: selectedTypes,
    };

    if (!isRandomLetter && letter) {
      updateData.letter = letter;
    }

    updateGameSessionMutation.mutate(
      { roomId, data: updateData },
      {
        onSuccess: (response) => {
          // Update state from response
          const sessionData = response?.data?.data || response?.data || response;
          if (sessionData) {
            setLetter(sessionData.letter || '');
            setIsRandomLetter(sessionData.is_random_letter);
            setSelectedTypes(sessionData.selected_types || []);
          }
          
          // Invalidate and refetch queries to ensure UI is up to date
          queryClient.invalidateQueries({ queryKey: ['gameSession', roomId] });
          queryClient.invalidateQueries({ queryKey: ['room', roomId] });
          refetchGameSession();
          
          // Clear any errors
          setError('');
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to update game rules. Please try again.';
          setError(errorMessage);
        }
      }
    );
  };

  if (isLoadingRoom || isLoadingTypes || isLoadingSession) {
    return (
      <div className={styles.hostGameRulePage}>
        <Text text="Loading game rules..." />
      </div>
    );
  }

  const gameTypes = gameTypesData?.data || gameTypesData || [];

  return (
    <div className={styles.hostGameRulePage}>
      <Header text="Configure Game Rules - Państwa Miasto" />
      
      <div className={styles.roomInfo}>
        <Text text={`Room ID: ${roomId}`} />
        {roomData && (
          <Text text={`Room Name: ${(roomData?.data || roomData)?.name || 'N/A'}`} />
        )}
      </div>

      <div className={styles.section}>
        <Header text="Choose Letter" />
        <div className={styles.letterSection}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isRandomLetter}
              onChange={handleRandomLetterToggle}
              className={styles.checkbox}
            />
            <Text text="Random Letter" />
          </label>
          
          {!isRandomLetter && (
            <div className={styles.letterInput}>
              <Text text="Enter Letter:" />
              <Input
                type="text"
                value={letter}
                onChange={handleLetterChange}
                placeholder="A-Z"
                maxLength={1}
                style={{ textTransform: 'uppercase', width: '60px', textAlign: 'center' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <Header text="Select Game Types" />
        <div className={styles.typesList}>
          {gameTypes.map((type) => (
            <label key={type.key} className={styles.typeItem}>
              <input
                type="checkbox"
                checked={selectedTypes.includes(type.key)}
                onChange={() => handleTypeToggle(type.key)}
                className={styles.checkbox}
              />
              <Text text={type.label} />
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <Text text={error} />
        </div>
      )}

      <div className={styles.actions}>
        <Button 
          onButtonClick={handleSave}
          disabled={updateGameSessionMutation.isPending}
        >
          {updateGameSessionMutation.isPending ? 'Saving...' : 'Save Rules'}
        </Button>
        <Button 
          onButtonClick={() => navigate(`/host`)}
        >
          Back to Room
        </Button>
      </div>
    </div>
  );
}
