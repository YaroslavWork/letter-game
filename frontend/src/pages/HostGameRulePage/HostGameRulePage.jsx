import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { success: showSuccess, error: showError, warning: showWarning } = useNotification();
  const { t } = useLanguage();
  const { roomId } = useParams();
  const [letter, setLetter] = useState('');
  const [isRandomLetter, setIsRandomLetter] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [totalRounds, setTotalRounds] = useState(1);
  const [roundTimerSeconds, setRoundTimerSeconds] = useState(60);
  const [reduceTimerOnCompleteSeconds, setReduceTimerOnCompleteSeconds] = useState(15);
  const [error, setError] = useState('');

  const { data: roomData, isLoading: isLoadingRoom, error: roomError } = useRoom(roomId);
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
        setReduceTimerOnCompleteSeconds(session.reduce_timer_on_complete_seconds || 15);
      }
      // Do NOT navigate - stay on the configuration page
    } else if (data.type === 'room_deleted_notification') {
      // Room was deleted by host
      showError(t('hostRules.roomDeleted'));
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
        setReduceTimerOnCompleteSeconds(session.reduce_timer_on_complete_seconds || 15);
      }
    }
  }, [gameSessionData]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Handle room not found or invalid UUID errors
    if (roomError && !isLoadingRoom) {
      const errorStatus = roomError.response?.status;
      const errorData = roomError.response?.data;
      
      if (errorStatus === 404) {
        showError(t('hostRules.roomNotFound'));
        navigate('/');
        return;
      } else if (errorStatus === 400) {
        const errorMessage = errorData?.room_id?.[0] || 
                           errorData?.error || 
                           errorData?.detail ||
                           t('hostRules.invalidRoomIdFormat');
        showError(errorMessage);
        navigate('/');
        return;
      }
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
  }, [isAuthenticated, navigate, roomData, isLoadingRoom, user, roomError, showError]);

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
        showWarning(t('hostRules.enterLetterOrRandom'));
        setError('');
        return;
      }
    }

    if (selectedTypes.length === 0) {
      showWarning(t('hostRules.selectAtLeastOneType'));
      setError('');
      return;
    }

    if (totalRounds < 1 || totalRounds > 10) {
      showWarning(t('hostRules.roundsBetween1And10'));
      setError('');
      return;
    }

    if (roundTimerSeconds < 10 || roundTimerSeconds > 600) {
      showWarning(t('hostRules.timerBetween10And600'));
      setError('');
      return;
    }

    if (reduceTimerOnCompleteSeconds < 5 || reduceTimerOnCompleteSeconds > 300) {
      showWarning(t('hostRules.reduceTimerBetween5And300'));
      setError('');
      return;
    }

    const updateData = {
      is_random_letter: totalRounds > 1 ? true : isRandomLetter,
      selected_types: selectedTypes,
      total_rounds: totalRounds,
      round_timer_seconds: roundTimerSeconds,
      reduce_timer_on_complete_seconds: reduceTimerOnCompleteSeconds,
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
            setReduceTimerOnCompleteSeconds(sessionData.reduce_timer_on_complete_seconds || 15);
          }
          
          // Invalidate and refetch queries to ensure UI is up to date
          queryClient.invalidateQueries({ queryKey: ['gameSession', roomId] });
          queryClient.invalidateQueries({ queryKey: ['room', roomId] });
          refetchGameSession();
          
          // Clear any errors and show success message
          setError('');
          showSuccess(t('hostRules.gameRulesSavedSuccessfully'));
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             t('hostRules.failedToUpdateRules');
          setError('');
          showError(errorMessage);
        }
      }
    );
  };

  if (isLoadingRoom || isLoadingTypes || isLoadingSession) {
    return (
      <div className={styles.hostGameRulePage}>
        <div className={styles.loadingContainer}>
          <Text text={t('hostRules.loadingGameRules')} />
        </div>
      </div>
    );
  }

  const gameTypes = gameTypesData?.data || gameTypesData || [];
  const room = roomData?.data || roomData;

  return (
    <div className={styles.hostGameRulePage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <Header text={t('hostRules.configureGameRules')} variant="playful" />
        </div>
        
        <div className={styles.roomInfo}>
          <div className={styles.roomInfoText}>
            <strong>{t('hostRules.roomId')}</strong> {roomId}
          </div>
          {room && (
            <div className={styles.roomInfoText}>
              <strong>{t('hostRules.roomName')}</strong> {room.name || t('hostRules.notAvailable')}
            </div>
          )}
        </div>

        {/* 2x2 Grid for Configuration Sections */}
        <div className={styles.configGrid}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Header text={t('hostRules.numberOfRounds')} />
            </div>
            <div className={styles.roundsSection}>
              <Text text={t('hostRules.rounds')} />
              <div className={styles.roundsInputWrapper}>
                <input
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
                  className={styles.roundsInput}
                />
                <span className={styles.roundsHint}>{t('hostRules.randomLetterEach')}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Header text={t('hostRules.roundTimer')} />
            </div>
            <div className={styles.roundsSection}>
              <Text text={t('hostRules.duration')} />
              <div className={styles.roundsInputWrapper}>
                <input
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
                  className={styles.roundsInput}
                />
                <Text text={t('hostRules.sec')} />
                <span className={styles.roundsHint}>
                  ({Math.floor(roundTimerSeconds / 60)}m {roundTimerSeconds % 60}s)
                </span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <Header text={t('hostRules.reduceTimerOnComplete')} />
            </div>
            <div className={styles.roundsSection}>
              <Text text={t('hostRules.reduceTo')} />
              <div className={styles.roundsInputWrapper}>
                <input
                  type="number"
                  value={reduceTimerOnCompleteSeconds}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 15;
                    if (value >= 5 && value <= 300) {
                      setReduceTimerOnCompleteSeconds(value);
                    }
                  }}
                  min="5"
                  max="300"
                  className={styles.roundsInput}
                />
                <Text text={t('hostRules.sec')} />
                <span className={styles.roundsHint}>
                  {t('hostRules.ifTimeGreaterThan', { seconds: reduceTimerOnCompleteSeconds })}
                </span>
              </div>
            </div>
          </div>

          {totalRounds === 1 ? (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Header text={t('hostRules.chooseLetter')} />
              </div>
              <div className={styles.letterSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isRandomLetter}
                    onChange={handleRandomLetterToggle}
                    className={styles.checkbox}
                  />
                  <Text text={t('hostRules.randomLetter')} />
                </label>
                
                {!isRandomLetter && (
                  <div className={styles.letterInput}>
                    <span className={styles.letterInputLabel}>{t('hostRules.enterLetter')}</span>
                    <input
                      type="text"
                      value={letter}
                      onChange={handleLetterChange}
                      placeholder={t('hostRules.enterLetterPlaceholder')}
                      maxLength={1}
                      className={styles.letterInputField}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.section}></div>
          )}
        </div>

        {/* Game Types Section - Full Width Below Grid */}
        <div className={`${styles.section} ${styles.typesSection}`}>
          <div className={styles.sectionHeader}>
            <Header text={t('hostRules.selectGameTypes')} />
          </div>
          <div className={styles.typesList}>
            {gameTypes.map((type) => (
              <label key={type.key} className={styles.typeItem}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.key)}
                  onChange={() => handleTypeToggle(type.key)}
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
            variant="playful"
            fullWidth
          >
            {updateGameSessionMutation.isPending ? t('hostRules.saving') : t('hostRules.saveRules')}
          </Button>
          <Button 
            onButtonClick={() => navigate(`/host`)}
            variant="primary"
            fullWidth
          >
            {t('hostRules.backToRoom')}
          </Button>
        </div>
      </div>
    </div>
  );
}
