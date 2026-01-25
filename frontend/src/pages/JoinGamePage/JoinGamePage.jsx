import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useMutationJoinRoom, useMutationLeaveRoom } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import { Input } from '../../components/UI/Input/Input';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './JoinGamePage.module.css';

export default function JoinGamePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { error: showError, warning: showWarning } = useNotification();
  const { t } = useLanguage();
  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameSession, setGameSession] = useState(null);
  const [error, setError] = useState('');
  const wasInRoomRef = useRef(false); // Track if user was previously in the room
  
  const joinRoomMutation = useMutationJoinRoom();
  const leaveRoomMutation = useMutationLeaveRoom();

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      const updatedRoom = data.data;
      const updatedPlayers = updatedRoom.players || [];
      
      // Check if game session is active (has a final_letter, meaning game has started)
      const gameSession = updatedRoom?.game_session;
      const isGameActive = gameSession && gameSession.final_letter;
      
      if (isGameActive && updatedRoom?.id) {
        // Game is active, navigate to game session page
        navigate(`/game/${updatedRoom.id}`);
        return;
      }
      
      // Check if current user is still in the room
      const isUserStillInRoom = updatedPlayers.some(
        player => String(player.user_id) === String(user?.id)
      );
      
      // Save previous state before updating
      const wasInRoom = wasInRoomRef.current;
      
      // Update state
      setRoom(updatedRoom);
      setPlayers(updatedPlayers);
      
      // Update game session if available
      // Only update if the game session data actually changed
      // This prevents the letter from changing when players join/leave
      if (updatedRoom.game_session) {
        // Use functional update to only update if data actually changed
        setGameSession(prevSession => {
          const newSession = updatedRoom.game_session;
          // If it's a random letter, don't update final_letter (it will be null/undefined)
          // Only update if the configuration actually changed
          if (prevSession && 
              prevSession.is_random_letter === newSession.is_random_letter &&
              prevSession.letter === newSession.letter &&
              JSON.stringify(prevSession.selected_types) === JSON.stringify(newSession.selected_types)) {
            // No actual change in game rules, return previous session to prevent re-render
            return prevSession;
          }
          return newSession;
        });
      } else {
        // Reset game session if not present
        setGameSession(null);
      }
      
      // Update ref to track current state
      wasInRoomRef.current = isUserStillInRoom;
      
      // If user was previously in room but now removed, redirect
      if (wasInRoom && !isUserStillInRoom) {
        showWarning(t('join.removedFromRoom'));
        wsClient.disconnect();
        // Clear stored room info
        localStorage.removeItem('room_id');
        localStorage.removeItem('room_type');
        wasInRoomRef.current = false;
        setRoom(null);
        setPlayers([]);
        setRoomId('');
        navigate('/');
        return; // Exit early to prevent further processing
      }
    } else if (data.type === 'player_removed_notification') {
      // Check if the removed user is the current user
      // Handle both string and number comparison
      const removedUserId = String(data.removed_user_id);
      const currentUserId = String(user?.id);
      
      if (removedUserId === currentUserId) {
        showWarning(t('join.removedFromRoom'));
        wsClient.disconnect();
        // Clear stored room info
        localStorage.removeItem('room_id');
        localStorage.removeItem('room_type');
        wasInRoomRef.current = false;
        setRoom(null);
        setPlayers([]);
        setRoomId('');
        navigate('/');
      }
    } else if (data.type === 'room_deleted_notification') {
      // Room was deleted by host
      showError(t('join.roomDeletedByHost'));
      wsClient.disconnect();
      // Clear stored room info
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      wasInRoomRef.current = false;
      setRoom(null);
      setPlayers([]);
      setRoomId('');
      navigate('/');
    } else if (data.type === 'game_started_notification') {
      // Game was started by host - update game session and navigate to game session page
      if (data.game_session) {
        // Store game session data in state before navigation
        setGameSession(data.game_session);
      }
      // Store room info if not already stored
      if (data.room_id) {
        localStorage.setItem('room_id', data.room_id);
        localStorage.setItem('room_type', 'join');
        // Store game session in localStorage temporarily so GameSessionPage can access it
        if (data.game_session) {
          localStorage.setItem('game_session', JSON.stringify(data.game_session));
        }
        // Navigate to game session page
        navigate(`/game/${data.room_id}`);
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    wsClient.on('message', handleWebSocketMessage);
    
    return () => {
      wsClient.off('message', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Clear any stored room info when entering JoinGamePage
    // This ensures we always show the join form, not reconnect
    localStorage.removeItem('room_id');
    localStorage.removeItem('room_type');
    
    // Disconnect any existing WebSocket connection
    if (wsClient.isConnected()) {
      wsClient.disconnect();
    }
    
    // Reset room state
    setRoom(null);
    setPlayers([]);
    setGameSession(null);
    setRoomId('');
    wasInRoomRef.current = false;
  }, [isAuthenticated, navigate]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!roomId.trim()) {
      showWarning(t('join.enterRoomId'));
      return;
    }

    joinRoomMutation.mutate(roomId.trim(), {
      onSuccess: (response) => {
        // Handle different response structures
        const roomData = response?.data?.data || response?.data || response;
        
        if (roomData && roomData.id) {
          setRoom(roomData);
          const initialPlayers = roomData.players || [];
          setPlayers(initialPlayers);
          
          // Set game session if available
          if (roomData.game_session) {
            setGameSession(roomData.game_session);
          } else {
            // Reset game session if not present
            setGameSession(null);
          }
          
          // Store room info in localStorage for reconnection
          localStorage.setItem('room_id', roomData.id);
          localStorage.setItem('room_type', 'join');
          
          // Check if user is in the initial players list
          const userIsInRoom = initialPlayers.some(
            player => String(player.user_id) === String(user?.id)
          );
          wasInRoomRef.current = userIsInRoom;
          
          // Ensure WebSocket is connected to receive game_started notifications
          setTimeout(() => {
            const token = localStorage.getItem('access_token');
            if (token) {
              // Disconnect first if connected to different room
              if (wsClient.isConnected() || wsClient.getState() === 'CONNECTING') {
                const currentRoomId = localStorage.getItem('room_id');
                if (currentRoomId && currentRoomId !== roomData.id.toString()) {
                  wsClient.disconnect();
                }
              }
              wsClient.connect(roomData.id, token);
            }
          }, 100);
        } else {
          const errorMsg = t('join.failedToJoinInvalidResponse');
          setError('');
          showError(errorMsg);
        }
      },
      onError: (error) => {
        const errorData = error.response?.data;
        let errorMessage = '';
        let isUuidError = false;

        // Check for UUID validation errors
        if (errorData?.room_id) {
          const roomIdError = Array.isArray(errorData.room_id) 
            ? errorData.room_id[0] 
            : errorData.room_id;
          
            // Check if it's a UUID format error
            if (typeof roomIdError === 'string') {
              const lowerError = roomIdError.toLowerCase();
              if (lowerError.includes('invalid') || 
                  lowerError.includes('uuid') || 
                  lowerError.includes('format') ||
                  lowerError.includes('not a valid')) {
                isUuidError = true;
                errorMessage = t('join.invalidRoomIdFormat');
            } else {
              errorMessage = roomIdError;
            }
          } else {
            errorMessage = roomIdError;
          }
        } else if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage = t('join.failedToJoinRoom');
        }

        // Clear error state (no longer using input field errors)
        setError('');
        
        // Show notification for UUID errors and other API errors
        if (isUuidError || error.response?.status === 400 || error.response?.status === 404) {
          showError(errorMessage);
        } else if (error.response?.status >= 500) {
          showError(t('join.serverError'));
        } else {
          // Show error for any other status codes
          showError(errorMessage);
        }
      }
    });
  };

  const handleLeaveRoom = () => {
    if (room) {
      leaveRoomMutation.mutate(room.id, {
        onSuccess: () => {
          wsClient.disconnect();
          // Clear stored room info
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_type');
          wasInRoomRef.current = false;
          setRoom(null);
          setPlayers([]);
          setRoomId('');
        },
        onError: () => {
          wsClient.disconnect();
          // Clear stored room info
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_type');
          wasInRoomRef.current = false;
          setRoom(null);
          setPlayers([]);
          setRoomId('');
        }
      });
    } else {
      navigate('/');
    }
  };

  if (!room) {
    return (
      <div className={styles.joinGamePage}>
        <div className={styles.decorativeCircle1}></div>
        <div className={styles.decorativeCircle2}></div>
        <div className={styles.joinContainer}>
          <Header text={t('join.joinGame')} variant="playful" />
          
          <form onSubmit={handleJoinRoom} className={styles.joinForm}>
            <Input
              type="text"
              name="roomId"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              placeholder={t('join.roomIdPlaceholder')}
            />
            
            <Button 
              type="submit" 
              disabled={joinRoomMutation.isPending}
              variant="playful"
              fullWidth
            >
              {joinRoomMutation.isPending ? t('join.joining') : t('join.joinRoom')}
            </Button>
          </form>

          <Button 
            onButtonClick={() => navigate('/')}
            variant="warning"
            fullWidth
          >
            {t('join.backToHome')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.joinGamePage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      
      <div className={styles.headerSection}>
        <Header text={`${room.name || t('host.room')}`} variant="playful" />
      </div>

      <div className={styles.topSection}>
        {/* Players Tiles - Left Upper Corner */}
        <div className={styles.playersSection}>
          <h2 className={styles.sectionTitle}>
            {t('host.players')} <span className={styles.count}>({players.length})</span>
          </h2>
          <div className={styles.playersGrid}>
            {players.length === 0 ? (
              <div className={styles.emptyState}>
                <p>{t('join.noPlayersYet')}</p>
              </div>
            ) : (
              players.map((player) => (
                <div 
                  key={player.id} 
                  className={`${styles.playerTile} ${player.user_id === room.host_id ? styles.hostTile : ''}`}
                >
                  <div className={styles.playerAvatar}>
                    {(player.game_name || player.username || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.playerInfo}>
                    <p className={styles.playerName}>
                      {player.game_name || player.username}
                    </p>
                    {player.user_id === room.host_id && (
                      <span className={styles.hostBadge}>{t('host.host')}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Room Info - Right Corner */}
        <div className={styles.roomInfoSection}>
          <h2 className={styles.sectionTitle}>
            {t('host.roomInfo')}
          </h2>
          <div className={styles.roomInfoCard}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('host.roomId')}</span>
              <span className={styles.infoValue}>{room.id}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('host.roomName')}</span>
              <span className={styles.infoValue}>{room.name || t('host.unnamedRoom')}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('host.host')}</span>
              <span className={styles.infoValue}>{room.host_game_name || room.host_username || 'Unknown'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('host.totalPlayers')}</span>
              <span className={styles.infoValue}>{players.length}</span>
            </div>
          </div>

          {gameSession && (
            <div className={styles.gameRulesCard}>
              <h3 className={styles.rulesTitle}>
                {t('host.gameRules')}
              </h3>
              <div className={styles.ruleItem}>
                <span className={styles.ruleLabel}>{t('host.letter')}:</span>
                <span className={styles.ruleValue}>
                  {gameSession.final_letter || (gameSession.is_random_letter ? t('host.random') : t('host.notSet'))}
                </span>
              </div>
              {gameSession.total_rounds && (
                <div className={styles.ruleItem}>
                  <span className={styles.ruleLabel}>{t('host.rounds')}:</span>
                  <span className={styles.ruleValue}>
                    {gameSession.total_rounds} {gameSession.total_rounds === 1 ? t('host.round') : t('host.roundsPlural')}
                  </span>
                </div>
              )}
              {gameSession.selected_types && gameSession.selected_types.length > 0 && (
                <div className={styles.ruleItem}>
                  <span className={styles.ruleLabel}>{t('host.types')}:</span>
                  <div className={styles.typesList}>
                    {gameSession.selected_types_display?.map((type, index) => (
                      <span key={index} className={styles.typeTag}>
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(!gameSession.selected_types || gameSession.selected_types.length === 0) && (
                <div className={styles.noRules}>
                  <p>{t('join.gameRulesNotConfigured')}</p>
                </div>
              )}
            </div>
          )}

          {!gameSession && (
            <div className={styles.gameRulesCard}>
              <h3 className={styles.rulesTitle}>
                {t('host.gameRules')}
              </h3>
                <div className={styles.noRules}>
                  <p>{t('join.gameRulesNotConfiguredYet')}</p>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actionsSection}>
        <Button 
          onButtonClick={handleLeaveRoom}
          variant="warning"
          fullWidth
        >
          {t('join.leaveRoom')}
        </Button>
      </div>
    </div>
  );
}
