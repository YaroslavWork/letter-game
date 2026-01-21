import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom, useGameSession, useMutationSubmitAnswer, usePlayerScores, useMutationAdvanceRound } from '../../features/hooks/index.hooks';
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
  const [submittedPlayers, setSubmittedPlayers] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState({});
  const [countdown, setCountdown] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const submitAnswerMutation = useMutationSubmitAnswer();
  const advanceRoundMutation = useMutationAdvanceRound();
  // Include totals when game is completed
  const includeTotals = gameSession?.is_completed || false;
  const { data: playerScoresData, refetch: refetchScores } = usePlayerScores(roomId, includeTotals);

  const { data: existingRoomData, isLoading: isLoadingRoom } = useRoom(roomId);
  const { data: gameSessionData, isLoading: isLoadingGameSession, refetch: refetchGameSession } = useGameSession(roomId);

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      const newGameSession = data.data?.game_session;
      const oldRound = gameSession?.current_round;
      
      setRoom(data.data);
      setPlayers(data.data.players || []);
      if (newGameSession) {
        setGameSession(newGameSession);
        
        // Check if round advanced
        if (oldRound && newGameSession.current_round !== oldRound) {
          // Round advanced, reset state
          setCountdown(null);
          setShowResults(false);
          setIsSubmitted(false);
          setAnswers({});
          setValidationErrors({});
          setSubmittedPlayers(new Set());
        }
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
    } else if (data.type === 'player_submitted_notification') {
      // Update submitted players set
      setSubmittedPlayers(prev => new Set([...prev, data.player_username]));
      // Show results when all players submit
      if (data.all_players_submitted) {
        setShowResults(true);
      }
      refetchScores();
    } else if (data.type === 'round_advancing_notification') {
      // Update countdown from backend
      setCountdown(data.countdown_seconds);
      setShowResults(true);
      // When countdown reaches 0, wait for room update
      if (data.countdown_seconds === 0) {
        // Round is advancing, wait for room update
        setTimeout(() => {
          refetchGameSession();
          refetchScores();
        }, 500);
      }
    } else if (data.type === 'room_deleted_notification') {
      alert('The room has been deleted.');
      wsClient.disconnect();
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      navigate('/');
    }
  }, [navigate, roomId, refetchGameSession, refetchScores, user]);

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
        
        // Update submitted players set
        const submitted = new Set();
        playerScores.forEach(ps => {
          if (ps.player_username) {
            submitted.add(ps.player_username);
          }
        });
        setSubmittedPlayers(submitted);
      }
    }
  }, [user, playerScoresData]);

  // Reset countdown when round changes or game completes
  useEffect(() => {
    if (gameSession) {
      if (gameSession.is_completed) {
        setCountdown(null);
        setShowResults(true);
      } else if (countdown === 0) {
        // Countdown finished, wait for backend to advance
        setCountdown(null);
      }
    }
  }, [gameSession?.current_round, gameSession?.is_completed, countdown]);

  // Reset answers when round changes
  const prevRoundRef = useRef(null);
  useEffect(() => {
    if (gameSession && gameSession.current_round) {
      const currentRound = gameSession.current_round;
      const prevRound = prevRoundRef.current;
      
      // Only reset if round actually changed (not on initial load)
      if (prevRound !== null && prevRound !== currentRound) {
        setIsSubmitted(false);
        setAnswers({});
        setValidationErrors({});
        setSubmittedPlayers(new Set());
        setCountdown(null);
        setShowResults(false);
        refetchScores();
      }
      
      prevRoundRef.current = currentRound;
    }
  }, [gameSession?.current_round, refetchScores]);

  // Refetch scores with totals when game is completed
  useEffect(() => {
    if (gameSession?.is_completed) {
      refetchScores();
    }
  }, [gameSession?.is_completed, refetchScores]);

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
    const letter = finalLetter?.toUpperCase();
    
    // Always update the answer value (allow typing)
    setAnswers(prev => ({
      ...prev,
      [gameType]: value
    }));
    
    // Validate that the word starts with the game letter (case-insensitive)
    if (letter && value.trim().length > 0) {
      const firstChar = value.trim()[0].toUpperCase();
      if (firstChar !== letter) {
        // Show error but allow typing
        setValidationErrors(prev => ({
          ...prev,
          [gameType]: `Word must start with the letter "${letter}"`
        }));
      } else {
        // Clear error if validation passes
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[gameType];
          return newErrors;
        });
      }
    } else {
      // Clear error for empty input
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[gameType];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    if (!roomId || !gameSession) return;

    // Check for validation errors
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      alert('Please fix validation errors before submitting. All words must start with the game letter or be left empty.');
      return;
    }

    // Validate all answers one more time before submission
    const letter = finalLetter?.toUpperCase();
    const invalidAnswers = [];
    gameSession.selected_types.forEach(type => {
      const answer = answers[type] || '';
      if (answer.trim() !== '' && letter) {
        const firstChar = answer.trim()[0].toUpperCase();
        if (firstChar !== letter) {
          invalidAnswers.push(type);
        }
      }
    });

    if (invalidAnswers.length > 0) {
      alert('Some answers do not start with the correct letter. Please fix them before submitting.');
      return;
    }

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

  const scoresResponse = playerScoresData?.data || playerScoresData || {};
  const playerScores = Array.isArray(scoresResponse) ? scoresResponse : (scoresResponse.round_scores || []);
  
  const allPlayersSubmitted = players.length > 0 && playerScores.length === players.length;
  
  const getPlayerAnswer = (playerId, gameTypeKey) => {
    const playerAnswer = playerScores.find(ps => ps.player === playerId);
    if (!playerAnswer || !playerAnswer.answers) return '';
    return playerAnswer.answers[gameTypeKey] || '';
  };

  const getPlayerPointsForCategory = (playerId, gameTypeKey) => {
    const playerAnswer = playerScores.find(ps => ps.player === playerId);
    if (!playerAnswer || !playerAnswer.points_per_category) return null;
    return playerAnswer.points_per_category[gameTypeKey];
  };

  const getPlayerTotalPoints = (playerId) => {
    const playerAnswer = playerScores.find(ps => ps.player === playerId);
    if (!playerAnswer || playerAnswer.points === null || playerAnswer.points === undefined) return null;
    return playerAnswer.points;
  };

  return (
    <div className={styles.gameSessionPage}>
      <Header text={room ? `Game Session - ${room.name}` : "Game Session"} />
      
      {gameSession && gameSession.is_completed ? (
        // Game completed - show winner and statistics
        <div className={styles.gameCompleted}>
          <Header text="🎉 Game Completed! 🎉" />
          {(() => {
            // Get total scores from API response if available
            const totalScores = {};
            const scoresResponse = playerScoresData?.data || playerScoresData;
            const apiTotalScores = scoresResponse?.total_scores || {};
            
            // Use API total scores if available, otherwise calculate from current round
            if (Object.keys(apiTotalScores).length > 0) {
              players.forEach(player => {
                totalScores[player.id] = apiTotalScores[player.id] || 0;
              });
            } else {
              // Fallback: use current round scores
              players.forEach(player => {
                const playerScore = playerScores.find(ps => ps.player === player.id || ps.player_username === player.username);
                totalScores[player.id] = playerScore?.points || 0;
              });
            }

            // Calculate winners
            let winners = [];
            let maxScore = -1;
            
            players.forEach(player => {
              const score = totalScores[player.id] || 0;
              if (score > maxScore) {
                maxScore = score;
                winners = [player];
              } else if (score === maxScore && maxScore > 0) {
                winners.push(player);
              }
            });

            return (
              <div className={styles.winnerSection}>
                {winners.length > 0 && (
                  <div className={styles.winnerDisplay}>
                    <Header text={winners.length === 1 ? "Winner:" : "Winners (Tie):"} />
                    {winners.map(winner => (
                      <Text key={winner.id} text={`🏆 ${winner.game_name || winner.username} - ${maxScore} points`} />
                    ))}
                  </div>
                )}
                <div className={styles.statisticsSection}>
                  <Header text="Final Statistics" />
                  <div className={styles.statsTable}>
                    <table className={styles.statisticsTable}>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Total Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map(player => (
                          <tr key={player.id}>
                            <td>{player.game_name || player.username}</td>
                            <td>{totalScores[player.id] || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          <div className={styles.gameInfo}>
            {gameSession && gameSession.total_rounds > 1 && (
              <div className={styles.roundInfo}>
                <Header text={`Round ${gameSession.current_round} of ${gameSession.total_rounds}`} />
              </div>
            )}
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

          {countdown !== null && allPlayersSubmitted && (
            <div className={styles.countdownDisplay}>
              <Header text={`Next round starting in: ${countdown} seconds`} />
            </div>
          )}
        </>
      )}

      {gameSession && !gameSession.is_completed && (
        <>
          <div className={styles.playersList}>
        <Header text="Players" />
        {players.map((player) => {
          const playerScore = playerScores.find(ps => ps.player === player.id || ps.player_username === player.username);
          const playerUsername = player.username || player.game_name;
          const hasSubmitted = submittedPlayers.has(playerUsername);
          const showPoints = allPlayersSubmitted && playerScore && playerScore.points !== null && playerScore.points !== undefined;
          return (
            <div key={player.id} className={styles.playerItem}>
              <Text text={`${player.game_name || player.username} ${player.user_id === room.host_id ? '(Host)' : ''}${hasSubmitted ? ' ✓ Submitted' : ''}${showPoints ? ` - ${playerScore.points} points` : ''}`} />
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
              const error = validationErrors[gameTypeKey];
              const currentValue = answers[gameTypeKey] || '';
              const isValid = !error && (currentValue.trim() === '' || (finalLetter && currentValue.trim()[0].toUpperCase() === finalLetter.toUpperCase()));
              
              return (
                <div key={index} className={styles.inputField}>
                  <Text text={`${type}:`} />
                  <input 
                    type="text" 
                    className={`${styles.textInput} ${error ? styles.textInputError : ''} ${isValid && currentValue.trim() !== '' ? styles.textInputValid : ''}`}
                    placeholder={`Enter a word for ${type} starting with "${finalLetter || '?'}"`}
                    value={currentValue}
                    onChange={(e) => handleAnswerChange(gameTypeKey, e.target.value)}
                    disabled={isSubmitted}
                  />
                  {error && (
                    <div className={styles.errorMessage}>
                      {error}
                    </div>
                  )}
                  {!error && currentValue.trim() !== '' && finalLetter && currentValue.trim()[0].toUpperCase() === finalLetter.toUpperCase() && (
                    <div className={styles.successMessage}>
                      ✓ Valid word starting with "{finalLetter}"
                    </div>
                  )}
                </div>
              );
            })}
            {!isSubmitted && (
              <Button 
                onButtonClick={handleSubmit}
                disabled={submitAnswerMutation.isPending || Object.keys(validationErrors).length > 0}
              >
                {submitAnswerMutation.isPending ? 'Submitting...' : 'Submit Answers'}
              </Button>
            )}
            {!isSubmitted && Object.keys(validationErrors).length > 0 && (
              <div className={styles.validationWarning}>
                Please fix validation errors before submitting.
              </div>
            )}
            {isSubmitted && !allPlayersSubmitted && (
              <Text text="Answers submitted! Waiting for other players..." />
            )}
            {allPlayersSubmitted && (
              <Text text={showResults ? `Round results! Next round in ${countdown || 0} seconds...` : "All players have submitted! See the results below."} />
            )}
          </>
        ) : (
          <Text text="No game types configured yet. Please wait for the host to configure the game." />
        )}
      </div>

      {(showResults || allPlayersSubmitted) && gameSession && gameSession.selected_types && displayTypes.length > 0 && (
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
                      const points = getPlayerPointsForCategory(player.id, gameTypeKey);
                      return (
                        <td key={player.id} className={styles.answerCell}>
                          <div>{answer || '-'}</div>
                          {points !== null && points !== undefined && (
                            <div className={styles.pointsLabel}>({points} pts)</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.totalCell}>Total Points</td>
                {players.map((player) => {
                  const totalPoints = getPlayerTotalPoints(player.id);
                  return (
                    <td key={player.id} className={styles.totalCell}>
                      {totalPoints !== null && totalPoints !== undefined ? totalPoints : '-'}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
        </>
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
