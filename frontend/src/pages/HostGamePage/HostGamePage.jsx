import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
      alert('The room has been deleted.');
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
      setRoomNameError('Room name must be 100 characters or less');
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
          alert('Failed to create room. Invalid response.');
          roomCreatedRef.current = false;
          setIsConnecting(false);
        }
      } catch (error) {
        alert('Failed to create room. Please try again.');
        roomCreatedRef.current = false;
        setIsConnecting(false);
      }
    };

    createRoom();
  };

  const handleDeleteRoom = () => {
    if (room && window.confirm('Are you sure you want to delete this room?')) {
      deleteRoomMutation.mutate(room.id, {
        onSuccess: () => {
          wsClient.disconnect();
          // Clear stored room info
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_type');
          navigate('/');
        },
        onError: () => {
          alert('Failed to delete room. Please try again.');
        }
      });
    }
  };

  const handleDeletePlayer = (playerId) => {
    if (room && window.confirm('Are you sure you want to remove this player?')) {
      deletePlayerMutation.mutate(
        { roomId: room.id, playerId },
        {
          onError: () => {
            alert('Failed to remove player. Please try again.');
          }
        }
      );
    }
  };

  const handleStartGame = () => {
    if (!room) return;
    
    // Check if game types are configured
    if (!gameSession || !gameSession.selected_types || gameSession.selected_types.length === 0) {
      alert('Please configure game types before starting the game.');
      return;
    }
    
    if (window.confirm('Are you sure you want to start the game? All players will be notified.')) {
      startGameSessionMutation.mutate(room.id, {
        onSuccess: () => {
          // Navigation will happen via WebSocket message
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to start game. Please try again.';
          alert(errorMessage);
        }
      });
    }
  };

  if (isConnecting || (!room && roomCreatedRef.current && !createRoomMutation.isError)) {
    return (
      <div className={styles.hostGamePage}>
        <Text text="Creating room..." />
      </div>
    );
  }

  if (!room && createRoomMutation.isError) {
    return (
      <div className={styles.hostGamePage}>
        <Header text="Host Game" />
        <Text text="Failed to create room" />
        <Button onButtonClick={() => {
          roomCreatedRef.current = false;
          setIsConnecting(false);
          setRoomName('');
          setRoomNameError('');
        }}>Try Again</Button>
        <Button onButtonClick={() => {
          roomCreatedRef.current = false;
          setIsConnecting(false);
          setRoomName('');
          setRoomNameError('');
          navigate('/');
        }}>Go Back</Button>
      </div>
    );
  }

  if (!room && roomCreatedRef.current && !isConnecting) {
    return (
      <div className={styles.hostGamePage}>
        <Header text="Host Game" />
        <Text text="Failed to create room. Please try again." />
        <Button onButtonClick={() => {
          roomCreatedRef.current = false;
          setIsConnecting(false);
          setRoomName('');
          setRoomNameError('');
        }}>Try Again</Button>
        <Button onButtonClick={() => {
          roomCreatedRef.current = false;
          setIsConnecting(false);
          setRoomName('');
          setRoomNameError('');
          navigate('/');
        }}>Go Back</Button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className={styles.hostGamePage}>
        <Header text="Host Game" />
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
          >
            {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
          </Button>
          <Button onButtonClick={() => navigate('/')}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.hostGamePage}>
      <Header text={`Host Game - ${room.name || 'Room'}`} />
      
      <div className={styles.roomInfo}>
        <Text text={`Room ID: ${room.id}`} />
        <Text text={`Room Name: ${room.name || 'Unnamed Room'}`} />
        <Text text={`Players: ${players.length}`} />
      </div>

      <div className={styles.playersList}>
        <Header text="Players" />
        {players.map((player) => (
          <div key={player.id} className={styles.playerItem}>
            <Text text={`${player.game_name || player.username} ${player.user_id === room.host_id ? '(Host)' : ''}`} />
            {player.user_id !== room.host_id && (
              <Button 
                onButtonClick={() => handleDeletePlayer(player.id)}
                className={styles.deleteButton}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      {gameSession && (
        <div className={styles.gameRules}>
          <Header text="Current Game Rules" />
          <div className={styles.ruleItem}>
            <Text text={`Letter: ${gameSession.final_letter || (gameSession.is_random_letter ? 'Random (will be selected when game starts)' : 'Not set')}`} />
          </div>
          {gameSession.selected_types && gameSession.selected_types.length > 0 && (
            <div className={styles.ruleItem}>
              <Text text="Selected Types:" />
              <div className={styles.typesList}>
                {gameSession.selected_types_display?.map((type, index) => (
                  <div key={index} className={styles.typeTag}>
                    <Text text={type} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!gameSession.selected_types || gameSession.selected_types.length === 0) && (
            <div className={styles.ruleItem}>
              <Text text="No game types configured yet. Click 'Configure Game Rules' to set up the game." />
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button onButtonClick={() => navigate(`/host/rules/${room.id}`)}>
          Configure Game Rules
        </Button>
        <Button 
          onButtonClick={handleStartGame}
          disabled={startGameSessionMutation.isPending || !gameSession || !gameSession.selected_types || gameSession.selected_types.length === 0}
        >
          {startGameSessionMutation.isPending ? 'Starting...' : 'Start a game'}
        </Button>
        <Button onButtonClick={handleDeleteRoom}>
          Delete Room
        </Button>
        <Button onButtonClick={() => {
          wsClient.disconnect();
          // Clear stored room info
          localStorage.removeItem('room_id');
          localStorage.removeItem('room_type');
          navigate('/');
        }}>
          Leave
        </Button>
      </div>
    </div>
  );
}
