import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom, useGameSession, useMutationSubmitAnswer, usePlayerScores } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './GameSessionPage.module.css';

export default function GameSessionPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameSession, setGameSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitAnswerMutation = useMutationSubmitAnswer();
  const { data: playerScoresData, refetch: refetchScores } = usePlayerScores(roomId);

  const { data: existingRoomData, isLoading: isLoadingRoom } = useRoom(roomId);
  const { data: gameSessionData, isLoading: isLoadingGameSession, refetch: refetchGameSession } = useGameSession(roomId);

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      setRoom(data.data);
      setPlayers(data.data.players || []);
      if (data.data.game_session) {
        setGameSession(data.data.game_session);
      }
      refetchScores();
    } else if (data.type === 'game_started_notification') {
      if (data.game_session) {
        setGameSession(data.game_session);
      }
      if (roomId) {
        setTimeout(() => {
          refetchGameSession();
        }, 500);
      }
    } else if (data.type === 'room_deleted_notification') {
      alert('The room has been deleted.');
      wsClient.disconnect();
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      navigate('/');
    }
  }, [navigate, roomId, refetchGameSession, refetchScores]);

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

    if (!roomId) {
      const storedRoomId = localStorage.getItem('room_id');
      if (storedRoomId) {
        navigate(`/game/${storedRoomId}`, { replace: true });
      } else {
        navigate('/');
      }
      return;
    }

    const storedGameSession = localStorage.getItem('game_session');
    if (storedGameSession) {
      try {
        const parsedSession = JSON.parse(storedGameSession);
        setGameSession(parsedSession);
        localStorage.removeItem('game_session');
      } catch (e) {
        console.error('Failed to parse stored game session:', e);
      }
    }

    if (existingRoomData && !room) {
      const roomData = existingRoomData?.data || existingRoomData;
      if (roomData && roomData.id) {
        setRoom(roomData);
        setPlayers(roomData.players || []);
        if (roomData.game_session) {
          setGameSession(roomData.game_session);
        }
        
        if (!wsClient.isConnected() && wsClient.getState() !== 'CONNECTING') {
          const token = localStorage.getItem('access_token');
          if (token) {
            wsClient.connect(roomData.id, token);
          }
        }
      }
    }

    if (gameSessionData) {
      const sessionData = gameSessionData?.data || gameSessionData;
      if (sessionData) {
        setGameSession(sessionData);
      }
    }
  }, [isAuthenticated, navigate, roomId, existingRoomData, room, gameSessionData]);

  useEffect(() => {
    if (roomId && room && !gameSession && !isLoadingGameSession) {
      const timer = setTimeout(() => {
        refetchGameSession();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [roomId, room, gameSession, isLoadingGameSession, refetchGameSession]);

  // Check if current user has already submitted answers (for reconnection scenario)
  useEffect(() => {
    if (user && playerScoresData) {
      const playerScores = playerScoresData?.data || playerScoresData || [];
      if (playerScores.length > 0) {
        const userAnswer = playerScores.find(ps => 
          ps.player === user.id || 
          ps.player_username === user.username ||
          String(ps.player) === String(user.id)
        );
        
        if (userAnswer && userAnswer.answers) {
          // User has already submitted, set submitted state and populate answers
          setIsSubmitted(true);
          // Populate answers with submitted values so user can see what they submitted
          setAnswers(userAnswer.answers);
        }
      }
    }
  }, [user, playerScoresData]);

  if (isLoadingRoom || !room) {
    return (
      <div className={styles.gameSessionPage}>
        <Text text="Loading game session..." />
      </div>
    );
  }

  const isFirstLoad = !gameSession && isLoadingGameSession;
  if (isFirstLoad) {
    return (
      <div className={styles.gameSessionPage}>
        <Text text="Loading game data..." />
      </div>
    );
  }

  const isHost = user?.id === room.host_id;
  const finalLetter = gameSession?.final_letter || gameSession?.letter;

  const getDisplayTypes = (gameSession) => {
    if (!gameSession || !gameSession.selected_types) return [];
    
    if (gameSession.selected_types_display && gameSession.selected_types_display.length > 0) {
      return gameSession.selected_types_display;
    }
    
    const typeMap = {
      'panstwo': 'Państwo',
      'miasto': 'Miasto',
      'imie': 'Imię',
      'zwierze': 'Zwierzę',
      'rzecz': 'Rzecz',
      'roslina': 'Roślina',
      'kolor': 'Kolor',
      'owoc_warzywo': 'Owoc lub Warzywo',
      'marka_samochodu': 'Marka samochodu',
      'czesc_ciala': 'Część ciała',
      'celebryta': 'Celebryta',
      'slowo_powyzej_8': 'Słowo powyżej 8 liter',
      'slowo_ponizej_5': 'Słowo poniżej 5 liter',
    };
    
    return gameSession.selected_types.map(type => typeMap[type] || type);
  };

  const displayTypes = getDisplayTypes(gameSession);

  const handleAnswerChange = (gameType, value) => {
    setAnswers(prev => ({
      ...prev,
      [gameType]: value
    }));
  };

  const handleSubmit = () => {
    if (!roomId || !gameSession) return;

    const answersToSubmit = {};
    gameSession.selected_types.forEach(type => {
      answersToSubmit[type] = answers[type] || '';
    });

    submitAnswerMutation.mutate(
      { roomId, data: { answers: answersToSubmit } },
      {
        onSuccess: () => {
          setIsSubmitted(true);
          refetchScores();
          alert('Answers submitted successfully!');
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to submit answers. Please try again.';
          alert(errorMessage);
        }
      }
    );
  };

  const playerScores = playerScoresData?.data || playerScoresData || [];
  
  const allPlayersSubmitted = players.length > 0 && playerScores.length === players.length;
  
  const getPlayerAnswer = (playerId, gameTypeKey) => {
    const playerAnswer = playerScores.find(ps => ps.player === playerId);
    if (!playerAnswer || !playerAnswer.answers) return '';
    return playerAnswer.answers[gameTypeKey] || '';
  };

  return (
    <div className={styles.gameSessionPage}>
      <Header text={room ? `Game Session - ${room.name}` : "Game Session"} />
      
      <div className={styles.gameInfo}>
        <div className={styles.letterDisplay}>
          <Header text={`Letter: ${finalLetter || 'Not set'}`} />
        </div>
        
        <div className={styles.roomInfo}>
          <Text text={`Room ID: ${room.id}`} />
          <Text text={`Room Name: ${room.name}`} />
          <Text text={`Players: ${players.length}`} />
          {isHost && <Text text="(You are the host)" />}
        </div>
      </div>

      <div className={styles.playersList}>
        <Header text="Players" />
        {players.map((player) => {
          const playerScore = playerScores.find(ps => ps.player === player.id || ps.player_username === player.username);
          return (
            <div key={player.id} className={styles.playerItem}>
              <Text text={`${player.game_name || player.username} ${player.user_id === room.host_id ? '(Host)' : ''}${playerScore ? ` - ${playerScore.points} points` : ''}`} />
            </div>
          );
        })}
      </div>

      {gameSession && gameSession.selected_types && gameSession.selected_types.length > 0 && displayTypes.length > 0 ? (
        <div className={styles.gameRules}>
          <Header text="Game Types" />
          <div className={styles.typesList}>
            {displayTypes.map((type, index) => (
              <div key={index} className={styles.typeTag}>
                <Text text={type} />
              </div>
            ))}
          </div>
        </div>
      ) : gameSession ? (
        <div className={styles.gameRules}>
          <Text text="Game types not configured yet." />
        </div>
      ) : null}

      <div className={styles.gameArea}>
        <Header text="Game Area" />
        <Text text="Start playing! Fill in words for each category starting with the letter above." />
        {gameSession && gameSession.selected_types && gameSession.selected_types.length > 0 && displayTypes.length > 0 ? (
          <>
            {displayTypes.map((type, index) => {
              const gameTypeKey = gameSession.selected_types[index];
              return (
                <div key={index} className={styles.inputField}>
                  <Text text={`${type}:`} />
                  <input 
                    type="text" 
                    className={styles.textInput}
                    placeholder={`Enter a word for ${type}`}
                    value={answers[gameTypeKey] || ''}
                    onChange={(e) => handleAnswerChange(gameTypeKey, e.target.value)}
                    disabled={isSubmitted}
                  />
                </div>
              );
            })}
            {!isSubmitted && (
              <Button 
                onButtonClick={handleSubmit}
                disabled={submitAnswerMutation.isPending}
              >
                {submitAnswerMutation.isPending ? 'Submitting...' : 'Submit Answers'}
              </Button>
            )}
            {isSubmitted && !allPlayersSubmitted && (
              <Text text="Answers submitted! Waiting for other players..." />
            )}
            {allPlayersSubmitted && (
              <Text text="All players have submitted! See the results below." />
            )}
          </>
        ) : (
          <Text text="No game types configured yet. Please wait for the host to configure the game." />
        )}
      </div>

      {allPlayersSubmitted && gameSession && gameSession.selected_types && displayTypes.length > 0 && (
        <div className={styles.resultsTable}>
          <Header text="Results Table" />
          <table className={styles.answersTable}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Category</th>
                {players.map((player) => (
                  <th key={player.id} className={styles.tableHeader}>
                    {player.game_name || player.username}
                    {player.user_id === room.host_id ? ' (Host)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayTypes.map((type, index) => {
                const gameTypeKey = gameSession.selected_types[index];
                return (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.categoryCell}>{type}</td>
                    {players.map((player) => {
                      const answer = getPlayerAnswer(player.id, gameTypeKey);
                      return (
                        <td key={player.id} className={styles.answerCell}>
                          {answer || '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.actions}>
        {isHost && (
          <Button onButtonClick={() => navigate(`/host/rules/${room.id}`)}>
            Configure Game Rules
          </Button>
        )}
        <Button onButtonClick={() => {
          const storedRoomType = localStorage.getItem('room_type');
          if (storedRoomType === 'host') {
            navigate('/host');
          } else {
            navigate('/join');
          }
        }}>
          Back to Room
        </Button>
      </div>
    </div>
  );
}
