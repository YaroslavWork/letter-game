import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  
  const joinRoomMutation = useMutationJoinRoom();
  const leaveRoomMutation = useMutationLeaveRoom();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    return () => {
      wsClient.off('message', handleWebSocketMessage);
      wsClient.disconnect();
    };
  }, [isAuthenticated, navigate]);

  const handleWebSocketMessage = (data) => {
    if (data.type === 'room_update') {
      setRoom(data.data);
      setPlayers(data.data.players || []);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    joinRoomMutation.mutate(roomId.trim(), {
      onSuccess: (response) => {
        const roomData = response.data;
        setRoom(roomData);
        setPlayers(roomData.players || []);
        
        // Connect to WebSocket
        const token = localStorage.getItem('access_token');
        if (token) {
          wsClient.connect(roomData.id, token);
          
          // Listen for room updates
          wsClient.on('message', handleWebSocketMessage);
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
          setRoom(null);
          setPlayers([]);
          setRoomId('');
        },
        onError: (error) => {
          console.error('Failed to leave room:', error);
          // Disconnect anyway
          wsClient.disconnect();
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
        <Header text="Join Game - Panstwa Miasto" />
        
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
      <Header text="Joined Room - Panstwa Miasto" />
      
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

      <div className={styles.actions}>
        <Button onButtonClick={handleLeaveRoom}>
          Leave Room
        </Button>
      </div>
    </div>
  );
}
