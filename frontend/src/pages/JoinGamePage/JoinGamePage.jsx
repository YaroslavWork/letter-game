import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMutationJoinRoom, useMutationLeaveRoom, useRoom } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import { Input } from '../../components/UI/Input/Input';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './JoinGamePage.module.css';

export default function JoinGamePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
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
        alert('You have been removed from the room by the host.');
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
        alert('You have been removed from the room by the host.');
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
      alert('The room has been deleted by the host.');
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

  // Check if we're reconnecting to an existing room
  const storedRoomId = localStorage.getItem('room_id');
  const storedRoomType = localStorage.getItem('room_type');
  const isReconnecting = storedRoomId && storedRoomType === 'join';
  const { data: existingRoomData, isLoading: isLoadingRoom } = useRoom(isReconnecting ? storedRoomId : null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // If reconnecting, try to load existing room
    if (isReconnecting && existingRoomData && !room) {
      // Handle different response structures
      const roomData = existingRoomData?.data?.data || existingRoomData?.data || existingRoomData;
      if (roomData && roomData.id) {
        const gameSession = roomData.game_session;
        
        // Check if game session is active (has a final_letter, meaning game has started)
        const isGameActive = gameSession && gameSession.final_letter;
        
        if (isGameActive) {
          // Game is active, navigate to game session page
          navigate(`/game/${roomData.id}`);
          return;
        }
        
        setRoom(roomData);
        const initialPlayers = roomData.players || [];
        setPlayers(initialPlayers);
        
        // Set game session if available
        if (gameSession) {
          setGameSession(gameSession);
        } else {
          // Reset game session if not present
          setGameSession(null);
        }
        
        // Check if user is in the initial players list
        const userIsInRoom = initialPlayers.some(
          player => String(player.user_id) === String(user?.id)
        );
        wasInRoomRef.current = userIsInRoom;
        
        // Ensure WebSocket is connected to receive game_started notifications
        // Connect to WebSocket if not already connected or if connected to different room
        const currentState = wsClient.getState();
        if (currentState !== 'OPEN' && currentState !== 'CONNECTING') {
          const token = localStorage.getItem('access_token');
          if (token) {
            wsClient.connect(roomData.id, token);
          }
        } else if (!wsClient.isConnected()) {
          // Reconnect if not properly connected
          const token = localStorage.getItem('access_token');
          if (token) {
            wsClient.disconnect();
            setTimeout(() => {
              wsClient.connect(roomData.id, token);
            }, 100);
          }
        }
      }
    }

    return () => {
      // Don't disconnect on unmount if we're still in the room
      // Only disconnect if navigating away
    };
  }, [isAuthenticated, navigate, isReconnecting, existingRoomData, room, user]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!roomId.trim()) {
      setError('Please enter a room ID');
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
          setError('Failed to join room. Invalid response.');
        }
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.room_id?.[0] || 
                           error.response?.data?.error || 
                           error.response?.data?.detail ||
                           'Failed to join room. Please check the room ID.';
        setError(errorMessage);
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

  if (isReconnecting && isLoadingRoom) {
    return (
      <div className={styles.joinGamePage}>
        <Header text="Join Game" />
        <Text text="Reconnecting to room..." />
      </div>
    );
  }

  if (!room) {
    return (
      <div className={styles.joinGamePage}>
        <Header text="Join Game" />
        
        <form onSubmit={handleJoinRoom} className={styles.joinForm}>
          <Input
            type="text"
            name="roomId"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setError('');
            }}
            placeholder="Enter Room ID"
            error={error}
          />
          
          <Button type="submit" disabled={joinRoomMutation.isPending}>
            {joinRoomMutation.isPending ? 'Joining...' : 'Join Room'}
          </Button>
        </form>

        <Button onButtonClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.joinGamePage}>
      <Header text={room ? `Joined Room - ${room.name}` : "Joined Room"} />
      
      <div className={styles.roomInfo}>
        <Text text={`Room ID: ${room.id}`} />
        <Text text={`Room Name: ${room.name}`} />
        <Text text={`Host: ${room.host_game_name || room.host_username}`} />
        <Text text={`Players: ${players.length}`} />
      </div>

      <div className={styles.playersList}>
        <Header text="Players" />
        {players.map((player) => (
          <div key={player.id} className={styles.playerItem}>
            <Text text={`${player.game_name || player.username} ${player.user_id === room.host_id ? '(Host)' : ''}`} />
          </div>
        ))}
      </div>

      <div className={styles.gameRules}>
        <Header text="Game Rules" />
        {gameSession ? (
          <>
            <div className={styles.ruleItem}>
              <Text text={`Letter: ${gameSession.final_letter || (gameSession.is_random_letter ? 'Random (will be selected when game starts)' : 'Not set')}`} />
            </div>
            {gameSession.selected_types && gameSession.selected_types.length > 0 ? (
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
            ) : (
              <div className={styles.ruleItem}>
                <Text text="Game types not yet configured by host" />
              </div>
            )}
          </>
        ) : (
          <div className={styles.ruleItem}>
            <Text text="Game rules not yet configured by host" />
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <Button onButtonClick={handleLeaveRoom}>
          Leave Room
        </Button>
      </div>
    </div>
  );
}
