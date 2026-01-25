import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useRoom, useGameSession, useMutationSubmitAnswer, usePlayerScores, useMutationAdvanceRound } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './GameSessionPage.module.css';

export default function GameSessionPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { error: showError, success: showSuccess, warning: showWarning } = useNotification();
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameSession, setGameSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedPlayers, setSubmittedPlayers] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [previousRoundScores, setPreviousRoundScores] = useState(null);
  const [previousRoundNumber, setPreviousRoundNumber] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const lastWebSocketUpdateRef = useRef(null);
  const autoSubmittedRef = useRef(false);

  const submitAnswerMutation = useMutationSubmitAnswer();
  const advanceRoundMutation = useMutationAdvanceRound();
  // Always include totals to show round/total format
  const { data: playerScoresData, refetch: refetchScores } = usePlayerScores(roomId, true);

  const { data: existingRoomData, isLoading: isLoadingRoom, error: roomError } = useRoom(roomId);
  const { data: gameSessionData, isLoading: isLoadingGameSession, refetch: refetchGameSession, error: gameSessionError } = useGameSession(roomId);

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      const newGameSession = data.data?.game_session;
      
      setRoom(data.data);
      setPlayers(data.data.players || []);
      if (newGameSession) {
        // Mark that we received a WebSocket update
        lastWebSocketUpdateRef.current = Date.now();
        
        // Use functional update to get current gameSession state
        setGameSession(prevGameSession => {
          const oldRound = prevGameSession?.current_round;
          const newRound = newGameSession.current_round;
          
          // Check if round advanced
          if (oldRound && newRound !== oldRound) {
            // Round advanced, store current scores as previous round scores before they're cleared
            const currentScoresResponse = playerScoresData?.data || playerScoresData || {};
            const currentPlayerScores = Array.isArray(currentScoresResponse) ? currentScoresResponse : (currentScoresResponse.round_scores || []);
            if (currentPlayerScores.length > 0) {
              setPreviousRoundScores(currentPlayerScores);
              setPreviousRoundNumber(oldRound);
            }
            // Round advanced, reset state for new round
            setIsSubmitted(false);
            setAnswers({});
            setValidationErrors({});
            setSubmittedPlayers(new Set());
            // Reset showResults to show categories again for the new round
            setShowResults(false);
            // Reset auto-submit flag for new round
            autoSubmittedRef.current = false;
            // Clear previous round scores after a brief delay to allow transition
            setTimeout(() => {
              setPreviousRoundScores(null);
              setPreviousRoundNumber(null);
            }, 1000);
            // Refetch scores for the new round
            refetchScores();
          } else {
            // Round didn't advance, refetch scores normally
            refetchScores();
          }
          
          return newGameSession;
        });
      } else {
        // No game session in update, refetch scores normally
        refetchScores();
      }
    } else if (data.type === 'game_started_notification') {
      // Mark that we received a WebSocket update
      lastWebSocketUpdateRef.current = Date.now();
      if (data.game_session) {
        // Always update gameSession when game starts - this has the letter
        setGameSession(data.game_session);
      }
      // Refetch gameSession after a short delay to ensure we have the latest data
      // This is important for the host who might have just started the game
      if (roomId) {
        setTimeout(() => {
          refetchGameSession();
          refetchScores();
        }, 300);
      }
    } else if (data.type === 'player_submitted_notification') {
      // Update submitted players set
      setSubmittedPlayers(prev => new Set([...prev, data.player_username]));
      // Show results when all players submit
      if (data.all_players_submitted) {
        setShowResults(true);
      }
      refetchScores();
    } else if (data.type === 'room_deleted_notification') {
      showError('The room has been deleted.');
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

    // Handle room not found or invalid UUID errors
    if (roomError && !isLoadingRoom) {
      const errorStatus = roomError.response?.status;
      const errorData = roomError.response?.data;
      
      if (errorStatus === 404) {
        showError('Room not found. The room may have been deleted or the room ID is invalid.');
        navigate('/');
      } else if (errorStatus === 400) {
        const errorMessage = errorData?.room_id?.[0] || 
                           errorData?.error || 
                           errorData?.detail ||
                           'Invalid room ID format.';
        showError(errorMessage);
        navigate('/');
      }
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

    if (existingRoomData) {
      const roomData = existingRoomData?.data || existingRoomData;
      if (roomData && roomData.id) {
        if (!room) {
          setRoom(roomData);
          setPlayers(roomData.players || []);
        }
        // Only set gameSession if we haven't received a recent WebSocket update
        // This prevents overwriting WebSocket updates with stale API data
        if (roomData.game_session) {
          const timeSinceLastWebSocketUpdate = lastWebSocketUpdateRef.current 
            ? Date.now() - lastWebSocketUpdateRef.current 
            : Infinity;
          // Always set if no gameSession yet (initial load), or if no recent WebSocket update
          if (!gameSession || timeSinceLastWebSocketUpdate > 2000) {
            setGameSession(prevSession => {
              // Always set if no previous session (initial load)
              if (!prevSession) {
                return roomData.game_session;
              }
              // Prefer session with a letter over one without
              if (prevSession.letter && !roomData.game_session.letter) {
                return prevSession; // Keep current session if it has a letter
              }
              if (!prevSession.letter && roomData.game_session.letter) {
                return roomData.game_session; // Prefer new session if it has a letter
              }
              // Don't overwrite if current session has a newer or same round
              if (roomData.game_session.current_round && prevSession.current_round) {
                if (prevSession.current_round >= roomData.game_session.current_round) {
                  return prevSession; // Keep current session if it's newer or same
                }
              }
              return roomData.game_session;
            });
          }
        }
        
        if (!room && !wsClient.isConnected() && wsClient.getState() !== 'CONNECTING') {
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
        // Only set gameSession if we haven't received a recent WebSocket update
        // This prevents overwriting WebSocket updates with stale API data
        const timeSinceLastWebSocketUpdate = lastWebSocketUpdateRef.current 
          ? Date.now() - lastWebSocketUpdateRef.current 
          : Infinity;
        // Always set if no gameSession yet (initial load), or if no recent WebSocket update
        if (!gameSession || timeSinceLastWebSocketUpdate > 2000) {
          setGameSession(prevSession => {
            // Always set if no previous session (initial load)
            if (!prevSession) {
              return sessionData;
            }
            // Prefer session with a letter over one without
            if (prevSession.letter && !sessionData.letter) {
              return prevSession; // Keep current session if it has a letter
            }
            if (!prevSession.letter && sessionData.letter) {
              return sessionData; // Prefer new session if it has a letter
            }
            // Don't overwrite if current session has a newer or same round
            if (sessionData.current_round && prevSession.current_round) {
              if (prevSession.current_round >= sessionData.current_round) {
                return prevSession; // Keep current session if it's newer or same
              }
            }
            return sessionData;
          });
        }
      }
    }
  }, [isAuthenticated, navigate, roomId, existingRoomData, room, gameSessionData, roomError, isLoadingRoom, showError]);

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

  // Calculate allPlayersSubmitted early so it can be used in useEffect hooks
  const scoresResponse = playerScoresData?.data || playerScoresData || {};
  let playerScores = Array.isArray(scoresResponse) ? scoresResponse : (scoresResponse.round_scores || []);
  
  // If we're showing previous round results, use those scores instead
  if (showResults && previousRoundScores && previousRoundNumber && gameSession?.current_round !== previousRoundNumber) {
    playerScores = previousRoundScores;
  } else if (playerScores.length > 0 && !previousRoundScores && gameSession?.current_round) {
    // Store current scores as previous round scores when they're available and we don't have stored scores
    setPreviousRoundScores(playerScores);
    setPreviousRoundNumber(gameSession.current_round);
  }
  
  const allPlayersSubmitted = players.length > 0 && playerScores.length === players.length;

  // Reset showResults when game completes
  useEffect(() => {
    if (gameSession && gameSession.is_completed) {
      setShowResults(true);
    }
  }, [gameSession?.is_completed]);

  // Show results when all players have submitted (for joiners who might miss WebSocket notification)
  useEffect(() => {
    if (allPlayersSubmitted && gameSession && !gameSession.is_completed && playerScoresData) {
      setShowResults(true);
    }
  }, [allPlayersSubmitted, gameSession, playerScoresData]);

  // Reset answers when round changes and store previous round scores
  const prevRoundRef = useRef(null);
  useEffect(() => {
    if (gameSession && gameSession.current_round) {
      const currentRound = gameSession.current_round;
      const prevRound = prevRoundRef.current;
      
      // Only reset if round actually changed (not on initial load)
      if (prevRound !== null && prevRound !== currentRound) {
        // Store current scores as previous round scores before they're cleared
        const currentScoresResponse = playerScoresData?.data || playerScoresData || {};
        const currentPlayerScores = Array.isArray(currentScoresResponse) ? currentScoresResponse : (currentScoresResponse.round_scores || []);
        if (currentPlayerScores.length > 0) {
          setPreviousRoundScores(currentPlayerScores);
          setPreviousRoundNumber(prevRound);
        }
        setIsSubmitted(false);
        setAnswers({});
        setValidationErrors({});
        setSubmittedPlayers(new Set());
        // Reset showResults to show categories again for the new round
        setShowResults(false);
        // Reset auto-submit flag for new round
        autoSubmittedRef.current = false;
        // Clear previous round scores after a brief delay to allow transition
        setTimeout(() => {
          setPreviousRoundScores(null);
          setPreviousRoundNumber(null);
        }, 1000);
        // Refetch scores for the new round
        refetchScores();
      }
      
      prevRoundRef.current = currentRound;
    }
  }, [gameSession?.current_round, playerScoresData]);

  // Refetch scores with totals when game is completed
  useEffect(() => {
    if (gameSession?.is_completed) {
      refetchScores();
    }
  }, [gameSession?.is_completed, refetchScores]);

  // Auto-submit function - submits answers when timer reaches 0
  const handleAutoSubmit = useCallback(() => {
    if (!roomId || !gameSession || isSubmitted || autoSubmittedRef.current) {
      return;
    }

    // Mark as auto-submitted to prevent multiple calls
    autoSubmittedRef.current = true;

    // Prepare answers - submit whatever is filled, empty strings for unfilled
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
          // Show notification that auto-submit happened
          showWarning('Time is up! Your answers have been automatically submitted.');
        },
        onError: (error) => {
          // Reset auto-submitted flag on error so user can try again
          autoSubmittedRef.current = false;
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to auto-submit answers. Please submit manually.';
          showError(errorMessage);
        }
      }
    );
  }, [roomId, gameSession, isSubmitted, answers, submitAnswerMutation, refetchScores]);

  // Calculate and update timer
  useEffect(() => {
    if (!gameSession || gameSession.is_completed || !gameSession.round_start_time) {
      setRemainingSeconds(null);
      // Reset auto-submit flag when timer is not active
      autoSubmittedRef.current = false;
      return;
    }

    // Reset auto-submit flag when round changes
    autoSubmittedRef.current = false;

    const calculateRemainingTime = () => {
      const startTime = new Date(gameSession.round_start_time);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const timerSeconds = gameSession.round_timer_seconds || 60;
      const remaining = Math.max(0, timerSeconds - elapsedSeconds);
      return remaining;
    };

    // Calculate initial remaining time
    setRemainingSeconds(calculateRemainingTime());

    // Update timer every second
    const interval = setInterval(() => {
      const remaining = calculateRemainingTime();
      setRemainingSeconds(remaining);
      
      // If timer reaches 0, auto-submit and stop updating
      if (remaining <= 0) {
        clearInterval(interval);
        // Auto-submit if not already submitted
        if (!isSubmitted && !autoSubmittedRef.current) {
          handleAutoSubmit();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameSession?.round_start_time, gameSession?.round_timer_seconds, gameSession?.current_round, gameSession?.is_completed, isSubmitted, handleAutoSubmit]);

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
    
    // If user starts typing in a new round, hide the previous round's results and refetch scores
    if (!isSubmitted && showResults && value.trim().length > 0) {
      setShowResults(false);
      setPreviousRoundScores(null);
      setPreviousRoundNumber(null);
      refetchScores();
    }
    
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
      showError('Please fix validation errors before submitting. All words must start with the game letter or be left empty.');
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
      showError('Some answers do not start with the correct letter. Please fix them before submitting.');
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
          showSuccess('Answers submitted successfully!');
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             'Failed to submit answers. Please try again.';
          showError(errorMessage);
        }
      }
    );
  };

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

  const getPlayerTotalPointsAllRounds = (playerId) => {
    const scoresResponse = playerScoresData?.data || playerScoresData || {};
    const apiTotalScores = scoresResponse?.total_scores || {};
    // If total_scores exists in response (even if empty), use it
    if (scoresResponse?.total_scores !== undefined) {
      return apiTotalScores[playerId] || 0;
    }
    // If total_scores not in response (API didn't include it), calculate from round points
    // This handles first round before any submissions
    const roundPoints = getPlayerTotalPoints(playerId);
    return roundPoints !== null ? roundPoints : 0;
  };

  const formatPointsDisplay = (roundPoints, playerId) => {
    const totalPoints = getPlayerTotalPointsAllRounds(playerId);
    // If round points are null/undefined, show 0 for current round
    const currentRoundPoints = roundPoints !== null && roundPoints !== undefined ? roundPoints : 0;
    return `${currentRoundPoints}/${totalPoints}`;
  };

  // Check if we should show red tint (someone submitted AND <= 15 seconds remaining)
  const shouldShowRedTint = !(showResults || allPlayersSubmitted) && 
                            remainingSeconds !== null && 
                            remainingSeconds <= 15 && 
                            (submittedPlayers.size > 0 || isSubmitted);
  
  return (
    <div className={`${styles.gameSessionPage} ${shouldShowRedTint ? styles.redTint : ''}`}>
      {gameSession && gameSession.is_completed ? (
        // Game completed - show winner and statistics
        <div className={styles.gameCompleted}>
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

            // Helper function to get initials
            const getInitials = (name) => {
              if (!name) return '?';
              const words = name.trim().split(' ');
              if (words.length >= 2) {
                return (words[0][0] + words[1][0]).toUpperCase();
              }
              return name.substring(0, 2).toUpperCase();
            };

            // Sort all players by score (descending)
            const sortedPlayers = [...players].sort((a, b) => {
              const scoreA = totalScores[a.id] || 0;
              const scoreB = totalScores[b.id] || 0;
              return scoreB - scoreA;
            });

            // Get top 3 winners
            const topThree = sortedPlayers.slice(0, 3).filter(player => (totalScores[player.id] || 0) > 0);

            return (
              <div className={styles.winnerSection}>
                <div className={styles.winnerAnnouncement}>
                  <Header text="Game Completed!" variant="playful" />
                  <p className={styles.winnerSubtitle}>Final Results</p>
                </div>

                {topThree.length > 0 && (
                  <div className={styles.podium}>
                    {/* Second Place (Silver) - Left */}
                    {topThree.length >= 2 && (
                      <div className={`${styles.podiumPlace} ${styles.secondPlace}`}>
                        <div className={styles.medal}>2</div>
                        <div className={styles.podiumAvatar}>
                          {getInitials(topThree[1].game_name || topThree[1].username)}
                        </div>
                        <div className={styles.podiumName}>
                          {topThree[1].game_name || topThree[1].username}
                        </div>
                        <div className={styles.podiumScore}>
                          {totalScores[topThree[1].id] || 0}
                        </div>
                      </div>
                    )}

                    {/* First Place (Gold) - Center */}
                    <div className={`${styles.podiumPlace} ${styles.firstPlace}`}>
                      <div className={styles.medal}>1</div>
                      <div className={styles.podiumAvatar}>
                        {getInitials(topThree[0].game_name || topThree[0].username)}
                      </div>
                      <div className={styles.podiumName}>
                        {topThree[0].game_name || topThree[0].username}
                      </div>
                      <div className={styles.podiumScore}>
                        {totalScores[topThree[0].id] || 0}
                      </div>
                    </div>

                    {/* Third Place (Bronze) - Right */}
                    {topThree.length >= 3 && (
                      <div className={`${styles.podiumPlace} ${styles.thirdPlace}`}>
                        <div className={styles.medal}>3</div>
                        <div className={styles.podiumAvatar}>
                          {getInitials(topThree[2].game_name || topThree[2].username)}
                        </div>
                        <div className={styles.podiumName}>
                          {topThree[2].game_name || topThree[2].username}
                        </div>
                        <div className={styles.podiumScore}>
                          {totalScores[topThree[2].id] || 0}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* All Players Statistics */}
                <div className={styles.statisticsSection}>
                  <Header text="All Players" variant="playful" />
                  <div className={styles.statsTable}>
                    <table className={styles.statisticsTable}>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Player</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPlayers.map((player, index) => (
                          <tr key={player.id} className={index < 3 ? styles.topThreeRow : ''}>
                            <td className={styles.rankCell}>
                              {index + 1}
                              {index === 0 && <span className={styles.rankBadge}>1st</span>}
                              {index === 1 && <span className={styles.rankBadge}>2nd</span>}
                              {index === 2 && <span className={styles.rankBadge}>3rd</span>}
                            </td>
                            <td>{player.game_name || player.username}</td>
                            <td className={styles.scoreCell}>{totalScores[player.id] || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Return to Room Button */}
                <div className={styles.returnToRoomSection}>
                  <Button 
                    onButtonClick={() => {
                      const storedRoomType = localStorage.getItem('room_type');
                      if (storedRoomType === 'host') {
                        navigate('/host');
                      } else {
                        navigate('/join');
                      }
                    }}
                    variant="playful"
                    fullWidth
                  >
                    Return to Room
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : gameSession && !gameSession.is_completed ? (
        <>
          {/* Top Bar: Letter (left), Rounds & Timer (center), Players (right) */}
          <div className={styles.topBar}>
            {/* Letter Display - Left */}
            <div className={styles.letterCard}>
              <div className={styles.letterLabel}>Letter</div>
              <div className={styles.letterValue}>{finalLetter || '?'}</div>
            </div>

            {/* Center Column - Rounds (top) and Timer/Next Round Button (bottom) */}
            <div className={styles.centerColumn}>
              {/* Round Info - Top */}
              {gameSession.total_rounds > 1 && (
                <div className={styles.roundInfo}>
                  Round {gameSession.current_round} of {gameSession.total_rounds}
                </div>
              )}

              {/* Timer Display - Bottom (only show when NOT showing results) */}
              {!(showResults || allPlayersSubmitted) && remainingSeconds !== null && (
                <div className={styles.timerCard}>
                  <div className={styles.timerLabel}>Time</div>
                  <div className={styles.timerValue}>
                    {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                  </div>
                </div>
              )}

              {/* Next Round Button - Bottom (only show when results are showing and user is host) */}
              {(showResults || allPlayersSubmitted) && isHost && gameSession.total_rounds > 1 && !gameSession.is_completed && (
                <div className={styles.nextRoundButtonCard}>
                  <Button 
                    onButtonClick={() => {
                      advanceRoundMutation.mutate(roomId, {
                        onSuccess: () => {
                          refetchGameSession();
                          refetchScores();
                        },
                        onError: (error) => {
                          const errorMessage = error.response?.data?.error || 
                                             error.response?.data?.detail ||
                                             'Failed to advance round. Please try again.';
                          showError(errorMessage);
                        }
                      });
                    }}
                    disabled={advanceRoundMutation.isPending}
                    variant="playful"
                    fullWidth
                  >
                    {advanceRoundMutation.isPending ? 'Advancing...' : 'Next Round'}
                  </Button>
                </div>
              )}
            </div>

            {/* Players Display - Right */}
            <div className={styles.playersCard}>
              <div className={styles.playersLabel}>Players</div>
              <div className={styles.playersList}>
                {players.map((player) => {
                  const playerScore = playerScores.find(ps => ps.player === player.id || ps.player_username === player.username);
                  const playerUsername = player.username || player.game_name;
                  const hasSubmitted = submittedPlayers.has(playerUsername);
                  const roundPoints = playerScore?.points !== null && playerScore?.points !== undefined ? playerScore.points : null;
                  return (
                    <div key={player.id} className={styles.playerBadge}>
                      <span className={styles.playerName}>
                        {player.game_name || player.username}
                        {player.user_id === room.host_id && <span className={styles.hostIcon}>Host</span>}
                      </span>
                      {hasSubmitted && <span className={styles.submittedIcon}>Submitted</span>}
                      <span className={styles.pointsBadge}>{formatPointsDisplay(roundPoints, player.id)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Categories Section - Show when time is active, hide when results show */}
          {!(showResults || allPlayersSubmitted) && gameSession && gameSession.selected_types && gameSession.selected_types.length > 0 && displayTypes.length > 0 && (
            <div className={styles.categoriesSection}>
              <h2 className={styles.sectionTitle}>
                Categories
              </h2>
              <div className={styles.categoriesGrid}>
                {displayTypes.map((type, index) => {
                  const gameTypeKey = gameSession.selected_types[index];
                  const error = validationErrors[gameTypeKey];
                  const currentValue = answers[gameTypeKey] || '';
                  const isValid = !error && (currentValue.trim() === '' || (finalLetter && currentValue.trim()[0].toUpperCase() === finalLetter.toUpperCase()));
                  
                  return (
                    <div key={index} className={styles.categoryCard}>
                      <label className={styles.categoryLabel}>{type}</label>
                      <input 
                        type="text" 
                        className={`${styles.categoryInput} ${error ? styles.categoryInputError : ''} ${isValid && currentValue.trim() !== '' ? styles.categoryInputValid : ''}`}
                        placeholder={`Start with "${finalLetter || '?'}"`}
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
                          Valid
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isSubmitted && (
                <div className={styles.submitSection}>
                  <Button 
                    onButtonClick={handleSubmit}
                    disabled={submitAnswerMutation.isPending || Object.keys(validationErrors).length > 0}
                    variant="playful"
                    fullWidth
                  >
                    {submitAnswerMutation.isPending ? 'Submitting...' : 'Submit Answers'}
                  </Button>
                  {Object.keys(validationErrors).length > 0 && (
                    <div className={styles.validationWarning}>
                      Please fix validation errors before submitting.
                    </div>
                  )}
                </div>
              )}
              {isSubmitted && !allPlayersSubmitted && (
                <div className={styles.waitingMessage}>
                  Answers submitted! Waiting for other players...
                </div>
              )}
            </div>
          )}

          {/* Results Table - Show when time is up or all players submitted */}
          {(showResults || allPlayersSubmitted) && gameSession && gameSession.selected_types && displayTypes.length > 0 && (
            <div className={styles.resultsSection}>
                <h2 className={styles.sectionTitle}>
                  Results
                </h2>
                <div className={styles.resultsTable}>
                  <table className={styles.answersTable}>
                    <thead>
                      <tr>
                        <th className={styles.tableHeader}>Category</th>
                        {players.map((player) => (
                          <th key={player.id} className={styles.tableHeader}>
                            {player.game_name || player.username}
                            {player.user_id === room.host_id && <span className={styles.hostIcon}>Host</span>}
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
                                  <div className={styles.answerText}>{answer || '-'}</div>
                                  {points !== null && points !== undefined && (
                                    <div className={styles.pointsLabel}>{points}</div>
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
                        <td className={styles.totalCell}>Round/Total</td>
                        {players.map((player) => {
                          const totalPoints = getPlayerTotalPoints(player.id);
                          return (
                            <td key={player.id} className={styles.totalCell}>
                              {formatPointsDisplay(totalPoints, player.id)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {isHost && (
              <Button 
                onButtonClick={() => navigate(`/host/rules/${room.id}`)}
                variant="playful"
                size="small"
              >
                Configure Rules
              </Button>
            )}
            <Button 
              onButtonClick={() => {
                const storedRoomType = localStorage.getItem('room_type');
                if (storedRoomType === 'host') {
                  navigate('/host');
                } else {
                  navigate('/join');
                }
              }}
              variant="warning"
              size="small"
            >
              ← Back to Room
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}>Loading</div>
          <p className={styles.loadingText}>Loading game session...</p>
        </div>
      )}
    </div>
  );
}
