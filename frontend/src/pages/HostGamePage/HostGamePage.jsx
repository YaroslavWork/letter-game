import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { useMutationCreateRoom, useMutationDeleteRoom, useMutationDeletePlayer, useMutationStartGameSession, useRoom } from '../../features/hooks/index.hooks';
import { axios } from '../../lib/axios';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import { Input } from '../../components/UI/Input/Input';
import styles from './HostGamePage.module.css';

export default function HostGamePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { error: showError, warning: showWarning } = useNotification();
  const { confirm } = useConfirmation();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameSession, setGameSession] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomNameError, setRoomNameError] = useState('');
  const roomCreatedRef = useRef(false);
  
  const createRoomMutation = useMutationCreateRoom();
  const deleteRoomMutation = useMutationDeleteRoom();
  const deletePlayerMutation = useMutationDeletePlayer();
  const startGameSessionMutation = useMutationStartGameSession();

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      // Check if game session is active (has a final_letter, meaning game has started)
      const gameSession = data.data?.game_session;
      const isGameActive = gameSession && gameSession.final_letter;
      
      if (isGameActive && data.data?.id) {
        // Game is active, navigate to game session page
        navigate(`/game/${data.data.id}`);
        return;
      }
      
      // Update room and players state in real-time when receiving room updates
      setRoom(data.data);
      setPlayers(data.data.players || []);
      // Update game session if available, but only if it actually changed
      // This prevents the letter from changing when players join/leave
      if (data.data.game_session) {
        setGameSession(prevSession => {
          const newSession = data.data.game_session;
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
      }
    } else if (data.type === 'room_deleted_notification') {
      // Room was deleted by host
      showError('The room has been deleted.');
      wsClient.disconnect();
      // Clear stored room info
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      navigate('/');
    } else if (data.type === 'game_started_notification') {
      // Game was started by host - update game session and navigate to game session page
      if (data.game_session) {
        setGameSession(data.game_session);
      }
      // Store room info if not already stored
      if (data.room_id) {
        localStorage.setItem('room_id', data.room_id);
        localStorage.setItem('room_type', 'host');
        // Navigate to game session page
        navigate(`/game/${data.room_id}`);
      }
    }
  }, [navigate]);

  const lastResponseRef = useRef(null);

  const handleRoomCreated = useCallback((roomData) => {
    if (roomData && roomData.id) {
      setRoom(roomData);
      setPlayers(roomData.players || []);
      if (roomData.game_session) {
        setGameSession(roomData.game_session);
      }
      setIsConnecting(false);
      
      // Store room info in localStorage for reconnection
      localStorage.setItem('room_id', roomData.id);
      localStorage.setItem('room_type', 'host');
      
      // Connect to WebSocket after a short delay to ensure listener is set up
      setTimeout(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
          wsClient.connect(roomData.id, token);
        }
      }, 100);
    }
  }, []);

  // Set up WebSocket message listener first (before connecting)
  // This ensures we're ready to receive real-time updates as soon as connected
  useEffect(() => {
    wsClient.on('message', handleWebSocketMessage);
    
    return () => {
      wsClient.off('message', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage]);

  useEffect(() => {
    if (!createRoomMutation.isPending && !createRoomMutation.isError && !room && roomCreatedRef.current && isConnecting) {
      if (createRoomMutation.data) {
        const response = createRoomMutation.data;
        const roomData = response?.data || response;
        handleRoomCreated(roomData);
      } else if (lastResponseRef.current) {
        const roomData = lastResponseRef.current?.data || lastResponseRef.current;
        handleRoomCreated(roomData);
      }
    }

    if (createRoomMutation.isError && createRoomMutation.error) {
      setIsConnecting(false);
      roomCreatedRef.current = false;
    }
  }, [createRoomMutation.isPending, createRoomMutation.isError, createRoomMutation.isSuccess, createRoomMutation.error, createRoomMutation.data, room, isConnecting, handleRoomCreated]);

  // Check if we should load an existing room (e.g., coming back from rules page)
  const storedRoomId = localStorage.getItem('room_id');
  const storedRoomType = localStorage.getItem('room_type');
  const shouldLoadExistingRoom = storedRoomId && storedRoomType === 'host';
  const { data: existingRoomData, isLoading: isLoadingExistingRoom } = useRoom(shouldLoadExistingRoom ? storedRoomId : null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // If we have a stored room and we're the host, load it instead of clearing
    // This allows navigation back from rules page to work correctly
    if (shouldLoadExistingRoom && existingRoomData && !room) {
      const roomData = existingRoomData?.data || existingRoomData;
      if (roomData && roomData.id && roomData.host_id === user?.id) {
        setRoom(roomData);
        setPlayers(roomData.players || []);
        if (roomData.game_session) {
          setGameSession(roomData.game_session);
        }
        setIsConnecting(false);
        roomCreatedRef.current = true;
        
        // Connect to WebSocket if not already connected
        if (!wsClient.isConnected() && wsClient.getState() !== 'CONNECTING') {
          const token = localStorage.getItem('access_token');
          if (token) {
            wsClient.connect(roomData.id, token);
          }
        }
        return;
      }
    }

    // Only clear stored room info if we're not loading an existing room
    // This allows navigation back from rules page to work correctly
    if (!shouldLoadExistingRoom && !isLoadingExistingRoom) {
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
    }
  }, [isAuthenticated, navigate, shouldLoadExistingRoom, existingRoomData, room, user, isLoadingExistingRoom]);

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      setRoomNameError('Please enter a room name');
      return;
    }

    if (roomName.trim().length > 100) {
      showWarning('Room name must be 100 characters or less');
      setRoomNameError('');
      return;
    }

    setRoomNameError('');
    roomCreatedRef.current = true;
    setIsConnecting(true);

    const createRoom = async () => {
      try {
        const response = await createRoomMutation.mutateAsync({ name: roomName.trim() });
        lastResponseRef.current = response;
        const roomData = response?.data || response;
        
        if (roomData && roomData.id) {
          handleRoomCreated(roomData);
        } else {
          showError('Failed to create room. Invalid response.');
          roomCreatedRef.current = false;
          setIsConnecting(false);
        }
      } catch (error) {
        showError('Failed to create room. Please try again.');
        roomCreatedRef.current = false;
        setIsConnecting(false);
      }
    };

    createRoom();
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    
    const confirmed = await confirm({
      title: 'Delete Room',
      message: 'Are you sure you want to delete this room? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonStyle: 'danger',
    });

    if (confirmed) {
      deleteRoomMutation.mutate(room.id, {
        onSuccess: () => {
          wsClient.disconnect();
          // Clear stored room info
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_type');
          navigate('/');
        },
        onError: () => {
          showError('Failed to delete room. Please try again.');
        }
      });
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!room) return;
    
    const confirmed = await confirm({
      title: 'Remove Player',
      message: 'Are you sure you want to remove this player from the room?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      confirmButtonStyle: 'danger',
    });

    if (confirmed) {
      deletePlayerMutation.mutate(
        { roomId: room.id, playerId },
        {
          onError: () => {
            showError('Failed to remove player. Please try again.');
          }
        }
      );
    }
  };

  const handleStartGame = async () => {
    if (!room) return;
    
    // Check if game types are configured
    if (!gameSession || !gameSession.selected_types || gameSession.selected_types.length === 0) {
      showWarning('Please configure game types before starting the game.');
      return;
    }
    
    const confirmed = await confirm({
      title: 'Start Game',
      message: 'Are you sure you want to start the game? All players will be notified.',
      confirmText: 'Start Game',
      cancelText: 'Cancel',
      confirmButtonStyle: 'success',
    });

    if (confirmed) {
      startGameSessionMutation.mutate(room.id, {
        onSuccess: () => {
          // Navigation will happen via WebSocket message
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to start game. Please try again.';
          showError(errorMessage);
        }
      });
    }
  };

  if (isConnecting || (!room && roomCreatedRef.current && !createRoomMutation.isError)) {
    return (
      <div className={styles.hostGamePage}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}>🎮</div>
          <p className={styles.loadingText}>Creating room...</p>
        </div>
      </div>
    );
  }

  if (!room && createRoomMutation.isError) {
    return (
      <div className={styles.hostGamePage}>
        <div className={styles.decorativeCircle1}></div>
        <div className={styles.decorativeCircle2}></div>
        <div className={styles.errorState}>
          <Header text="Host Game" variant="playful" />
          <div className={styles.errorCard}>
            <span className={styles.errorIcon}>⚠️</span>
            <p className={styles.errorText}>Failed to create room</p>
          </div>
          <div className={styles.errorActions}>
            <Button 
              onButtonClick={() => {
                roomCreatedRef.current = false;
                setIsConnecting(false);
                setRoomName('');
                setRoomNameError('');
              }}
              variant="playful"
            >
              Try Again
            </Button>
            <Button 
              onButtonClick={() => {
                roomCreatedRef.current = false;
                setIsConnecting(false);
                setRoomName('');
                setRoomNameError('');
                navigate('/');
              }}
              variant="warning"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!room && roomCreatedRef.current && !isConnecting) {
    return (
      <div className={styles.hostGamePage}>
        <div className={styles.decorativeCircle1}></div>
        <div className={styles.decorativeCircle2}></div>
        <div className={styles.errorState}>
          <Header text="Host Game" variant="playful" />
          <div className={styles.errorCard}>
            <span className={styles.errorIcon}>⚠️</span>
            <p className={styles.errorText}>Failed to create room. Please try again.</p>
          </div>
          <div className={styles.errorActions}>
            <Button 
              onButtonClick={() => {
                roomCreatedRef.current = false;
                setIsConnecting(false);
                setRoomName('');
                setRoomNameError('');
              }}
              variant="playful"
            >
              Try Again
            </Button>
            <Button 
              onButtonClick={() => {
                roomCreatedRef.current = false;
                setIsConnecting(false);
                setRoomName('');
                setRoomNameError('');
                navigate('/');
              }}
              variant="warning"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className={styles.hostGamePage}>
        <div className={styles.decorativeCircle1}></div>
        <div className={styles.decorativeCircle2}></div>
        <div className={styles.createRoomContainer}>
          <Header text="Host Game" variant="playful" />
          <div className={styles.createRoomForm}>
            <Input
              type="text"
              name="roomName"
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value);
                setRoomNameError('');
              }}
              placeholder="Enter room name (e.g., My Game Room)"
              error={roomNameError}
            />
            <Button 
              onButtonClick={handleCreateRoom}
              disabled={createRoomMutation.isPending || !roomName.trim()}
              variant="playful"
              fullWidth
            >
              {createRoomMutation.isPending ? '⏳ Creating...' : '🚀 Create Room'}
            </Button>
            <Button 
              onButtonClick={() => navigate('/')}
              variant="warning"
              fullWidth
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.hostGamePage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      
      <div className={styles.headerSection}>
        <Header text={`${room.name || 'Room'}`} variant="playful" />
      </div>

      <div className={styles.topSection}>
        {/* Players Tiles - Left Upper Corner */}
        <div className={styles.playersSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.icon}>👥</span>
            Players <span className={styles.count}>({players.length})</span>
          </h2>
          <div className={styles.playersGrid}>
            {players.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No players yet</p>
                <span className={styles.emptyIcon}>🎮</span>
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
                      <span className={styles.hostBadge}>👑 Host</span>
                    )}
                  </div>
                  {player.user_id !== room.host_id && (
                    <button 
                      className={styles.removeButton}
                      onClick={() => handleDeletePlayer(player.id)}
                      aria-label="Remove player"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Room Info - Right Corner */}
        <div className={styles.roomInfoSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.icon}>🏠</span>
            Room Info
          </h2>
          <div className={styles.roomInfoCard}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Room ID</span>
              <span className={styles.infoValue}>{room.id}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Room Name</span>
              <span className={styles.infoValue}>{room.name || 'Unnamed Room'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Total Players</span>
              <span className={styles.infoValue}>{players.length}</span>
            </div>
          </div>

          {gameSession && (
            <div className={styles.gameRulesCard}>
              <h3 className={styles.rulesTitle}>
                <span className={styles.icon}>⚙️</span>
                Game Rules
              </h3>
              <div className={styles.ruleItem}>
                <span className={styles.ruleLabel}>Letter:</span>
                <span className={styles.ruleValue}>
                  {gameSession.final_letter || (gameSession.is_random_letter ? '🎲 Random' : 'Not set')}
                </span>
              </div>
              {gameSession.selected_types && gameSession.selected_types.length > 0 && (
                <div className={styles.ruleItem}>
                  <span className={styles.ruleLabel}>Types:</span>
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
                  <span className={styles.emptyIcon}>📝</span>
                  <p>No game types configured yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actionsSection}>
        <Button 
          onButtonClick={() => navigate(`/host/rules/${room.id}`)}
          variant="playful"
          fullWidth
        >
          ⚙️ Configure Game Rules
        </Button>
        <Button 
          onButtonClick={handleStartGame}
          disabled={startGameSessionMutation.isPending || !gameSession || !gameSession.selected_types || gameSession.selected_types.length === 0}
          variant="success"
          fullWidth
        >
          {startGameSessionMutation.isPending ? '⏳ Starting...' : '🚀 Start Game'}
        </Button>
        <div className={styles.secondaryActions}>
          <Button 
            onButtonClick={handleDeleteRoom}
            variant="danger"
            size="small"
          >
            🗑️ Delete Room
          </Button>
          <Button 
            onButtonClick={() => {
              wsClient.disconnect();
              localStorage.removeItem('room_id');
              localStorage.removeItem('room_type');
              navigate('/');
            }}
            variant="warning"
            size="small"
          >
            🚪 Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
