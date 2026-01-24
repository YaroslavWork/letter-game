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
  const [totalRounds, setTotalRounds] = useState(1);
  const [roundTimerSeconds, setRoundTimerSeconds] = useState(60);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
        setTotalRounds(session.total_rounds || 1);
        setRoundTimerSeconds(session.round_timer_seconds || 60);
      }
      // Do NOT navigate - stay on the configuration page
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
        setTotalRounds(session.total_rounds || 1);
        setRoundTimerSeconds(session.round_timer_seconds || 60);
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
      
      // Store room info in localStorage for navigation back to room
      if (room && room.id) {
        localStorage.setItem('room_id', room.id);
        localStorage.setItem('room_type', 'host');
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
    setSuccessMessage('');

    // If rounds > 1, always use random letters
    if (totalRounds > 1) {
      // Force random letter when rounds > 1
      if (!isRandomLetter) {
        setIsRandomLetter(true);
        setLetter('');
      }
    } else {
      // Single round: validate letter
      if (!isRandomLetter && !letter) {
        setError('Please enter a letter or select random letter');
        return;
      }
    }

    if (selectedTypes.length === 0) {
      setError('Please select at least one game type');
      return;
    }

    if (totalRounds < 1 || totalRounds > 10) {
      setError('Number of rounds must be between 1 and 10');
      return;
    }

    if (roundTimerSeconds < 10 || roundTimerSeconds > 600) {
      setError('Timer duration must be between 10 and 600 seconds');
      return;
    }

    const updateData = {
      is_random_letter: totalRounds > 1 ? true : isRandomLetter,
      selected_types: selectedTypes,
      total_rounds: totalRounds,
      round_timer_seconds: roundTimerSeconds,
    };

    if (totalRounds === 1 && !isRandomLetter && letter) {
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
            setTotalRounds(sessionData.total_rounds || 1);
            setRoundTimerSeconds(sessionData.round_timer_seconds || 60);
          }
          
          // Invalidate and refetch queries to ensure UI is up to date
          queryClient.invalidateQueries({ queryKey: ['gameSession', roomId] });
          queryClient.invalidateQueries({ queryKey: ['room', roomId] });
          refetchGameSession();
          
          // Clear any errors and show success message
          setError('');
          setSuccessMessage('Game rules saved successfully!');
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            setSuccessMessage('');
          }, 3000);
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to update game rules. Please try again.';
          setError(errorMessage);
          setSuccessMessage('');
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
        <Header text="Number of Rounds" />
        <div className={styles.roundsSection}>
          <Text text="How many rounds do you want to play?" />
          <Input
            type="number"
            value={totalRounds}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1;
              if (value >= 1 && value <= 10) {
                setTotalRounds(value);
              }
            }}
            min="1"
            max="10"
            style={{ width: '100px', textAlign: 'center' }}
          />
          <Text text="(Each round will use a random letter)" />
        </div>
      </div>

      <div className={styles.section}>
        <Header text="Round Timer" />
        <div className={styles.roundsSection}>
          <Text text="Timer duration per round (in seconds):" />
          <Input
            type="number"
            value={roundTimerSeconds}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 60;
              if (value >= 10 && value <= 600) {
                setRoundTimerSeconds(value);
              }
            }}
            min="10"
            max="600"
            style={{ width: '100px', textAlign: 'center' }}
          />
          <Text text={`(${Math.floor(roundTimerSeconds / 60)} minutes ${roundTimerSeconds % 60} seconds)`} />
        </div>
      </div>

      {totalRounds === 1 && (
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
      )}

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

      {successMessage && (
        <div className={styles.success}>
          <Text text={successMessage} />
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
