import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useRoom, useGameSession, useMutationSubmitAnswer, usePlayerScores, useMutationAdvanceRound, useMutationEndGameSession, useGameTimer, useAnswerForm, useRoundManagement, useGameState } from '../../features/hooks/index.hooks';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import GameTimer from '../../components/UI/GameTimer/GameTimer';
import AnswerForm from '../../components/UI/AnswerForm/AnswerForm';
import ResultsTable from '../../components/UI/ResultsTable/ResultsTable';
import PlayerList from '../../components/UI/PlayerList/PlayerList';
import GameCompleted from '../../components/UI/GameCompleted/GameCompleted';
import styles from './GameSessionPage.module.css';

export default function GameSessionPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { error: showError, success: showSuccess, warning: showWarning } = useNotification();
  const { t } = useLanguage();
  const { roomId } = useParams();
  const lastWebSocketUpdateRef = useRef(null);

  // Use game state reducer
  const { state, actions } = useGameState();
  const {
    room,
    players,
    gameSession,
    answers,
    isSubmitted,
    submittedPlayers,
    validationErrors,
    showResults,
    isGameCompleted,
    previousGameSessionId
  } = state;

  const submitAnswerMutation = useMutationSubmitAnswer();
  const advanceRoundMutation = useMutationAdvanceRound();
  const endGameSessionMutation = useMutationEndGameSession();
  // Always include totals to show round/total format
  const { data: playerScoresData, refetch: refetchScores } = usePlayerScores(roomId, true);

  const { data: existingRoomData, isLoading: isLoadingRoom, error: roomError } = useRoom(roomId);
  const { data: gameSessionData, isLoading: isLoadingGameSession, refetch: refetchGameSession } = useGameSession(roomId);
  
  // Use answer form hook for validation
  const finalLetter = gameSession?.final_letter || gameSession?.letter;
  const { validateAnswer, validateAllAnswers } = useAnswerForm(finalLetter, t);

  // Callback for round changes - resets form state
  const handleRoundChange = useCallback(() => {
    actions.resetRound();
  }, [actions]);

  // Use round management hook
  const {
    previousRoundScores,
    previousRoundNumber,
    handleRoundAdvancement,
    clearPreviousRoundData,
    getPlayerScores,
    showSeeResults
  } = useRoundManagement(gameSession, playerScoresData, refetchScores, handleRoundChange);

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'room_update') {
      const newGameSession = data.data?.game_session;
      
      actions.setRoom(data.data);
      actions.setPlayers(data.data.players || []);
      if (newGameSession) {
        // Mark that we received a WebSocket update
        lastWebSocketUpdateRef.current = Date.now();
        
        // Check if this is a new game session after completion
        if (isGameCompleted && newGameSession.id !== previousGameSessionId && newGameSession.id !== gameSession?.id) {
          // New game session started after completion
          actions.newGameSession(newGameSession);
        } else {
          // Check if round advanced
          const oldRound = gameSession?.current_round;
          const newRound = newGameSession.current_round;
          
          // Check if round advanced using the hook
          const currentScoresResponse = playerScoresData?.data || playerScoresData || {};
          const currentPlayerScores = Array.isArray(currentScoresResponse) 
            ? currentScoresResponse 
            : (currentScoresResponse.round_scores || []);
          
          const roundAdvanced = handleRoundAdvancement(oldRound, newRound, currentPlayerScores);
          
          if (!roundAdvanced) {
            // Round didn't advance, refetch scores normally
            refetchScores();
          }
          
          // Update game session
          actions.updateGameSession(newGameSession);
        }
      } else {
        // No game session in update, refetch scores normally
        refetchScores();
      }
    } else if (data.type === 'game_started_notification') {
      // Mark that we received a WebSocket update
      lastWebSocketUpdateRef.current = Date.now();
      if (data.game_session) {
        // Check if this is a new game session after completion
        if (isGameCompleted && data.game_session.id !== previousGameSessionId && data.game_session.id !== gameSession?.id) {
          actions.newGameSession(data.game_session);
        } else {
          // Always update gameSession when game starts - this has the letter
          actions.setGameSession(data.game_session);
        }
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
      actions.addSubmittedPlayer(data.player_username);
      // Show results when all players submit
      if (data.all_players_submitted) {
        actions.setShowResults(true);
      }
      refetchScores();
    } else if (data.type === 'room_deleted_notification') {
      showError(t('game.roomNotFound'));
      wsClient.disconnect();
      localStorage.removeItem('room_id');
      localStorage.removeItem('room_type');
      navigate('/');
    }
  }, [navigate, roomId, refetchGameSession, refetchScores, handleRoundAdvancement, playerScoresData, actions, isGameCompleted, previousGameSessionId, gameSession, showError, t]);

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
        showError(t('game.roomNotFound'));
        navigate('/');
      } else if (errorStatus === 400) {
        const errorMessage = errorData?.room_id?.[0] || 
                           errorData?.error || 
                           errorData?.detail ||
                           t('game.invalidRoomIdFormat');
        showError(errorMessage);
        navigate('/');
      }
    }

    const storedGameSession = localStorage.getItem('game_session');
    if (storedGameSession) {
      try {
        const parsedSession = JSON.parse(storedGameSession);
        actions.setGameSession(parsedSession);
        localStorage.removeItem('game_session');
      } catch (e) {
        console.error('Failed to parse stored game session:', e);
      }
    }

    if (existingRoomData) {
      const roomData = existingRoomData?.data || existingRoomData;
      if (roomData && roomData.id) {
        if (!room) {
          actions.setRoom(roomData);
          actions.setPlayers(roomData.players || []);
        }
        // Only set gameSession if we haven't received a recent WebSocket update
        // This prevents overwriting WebSocket updates with stale API data
        if (roomData.game_session) {
          const timeSinceLastWebSocketUpdate = lastWebSocketUpdateRef.current 
            ? Date.now() - lastWebSocketUpdateRef.current 
            : Infinity;
          // Always set if no gameSession yet (initial load), or if no recent WebSocket update
          if (!gameSession || timeSinceLastWebSocketUpdate > 2000) {
            // Prefer session with a letter over one without
            if (gameSession?.letter && !roomData.game_session.letter) {
              // Keep current session if it has a letter
            } else if (!gameSession?.letter && roomData.game_session.letter) {
              // Prefer new session if it has a letter
              actions.updateGameSession(roomData.game_session);
            } else if (!gameSession) {
              // Always set if no previous session (initial load)
              actions.setGameSession(roomData.game_session);
            } else {
              // Don't overwrite if current session has a newer or same round
              if (roomData.game_session.current_round && gameSession.current_round) {
                if (gameSession.current_round < roomData.game_session.current_round) {
                  actions.updateGameSession(roomData.game_session);
                }
              } else {
                actions.updateGameSession(roomData.game_session);
              }
            }
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
          // Prefer session with a letter over one without
          if (gameSession?.letter && !sessionData.letter) {
            // Keep current session if it has a letter
          } else if (!gameSession?.letter && sessionData.letter) {
            // Prefer new session if it has a letter
            actions.updateGameSession(sessionData);
          } else if (!gameSession) {
            // Always set if no previous session (initial load)
            actions.setGameSession(sessionData);
          } else {
            // Don't overwrite if current session has a newer or same round
            if (sessionData.current_round && gameSession.current_round) {
              if (gameSession.current_round < sessionData.current_round) {
                actions.updateGameSession(sessionData);
              }
            } else {
              actions.updateGameSession(sessionData);
            }
          }
        }
      }
    }
  }, [isAuthenticated, navigate, roomId, existingRoomData, room, gameSessionData, roomError, isLoadingRoom, showError, actions, gameSession, t]);

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
          actions.setIsSubmitted(true);
          // Populate answers with submitted values so user can see what they submitted
          actions.setAnswers(userAnswer.answers);
        }
        
        // Update submitted players set
        const submitted = new Set();
        playerScores.forEach(ps => {
          if (ps.player_username) {
            submitted.add(ps.player_username);
          }
        });
        actions.setSubmittedPlayers(submitted);
      }
    }
  }, [user, playerScoresData, actions]);

  // Get player scores using the hook (handles previous round logic)
  const playerScores = getPlayerScores();
  
  // Calculate allPlayersSubmitted - only check current round scores, not previous round
  // When showing previous round results, we shouldn't consider all players as submitted for current round
  // Also, if we just advanced to a new round (submittedPlayers is empty), don't use old scores
  const isShowingPreviousRound = showResults && previousRoundScores && previousRoundNumber && gameSession?.current_round !== previousRoundNumber;
  const isNewRound = submittedPlayers.size === 0; // New round means no one has submitted yet
  const currentRoundScores = isShowingPreviousRound ? [] : playerScores;
  // Only consider all players submitted if we're not showing previous round AND it's not a new round
  const allPlayersSubmitted = !isNewRound && !isShowingPreviousRound && players.length > 0 && currentRoundScores.length === players.length;

  // Reset showResults when game completes
  useEffect(() => {
    if (gameSession && gameSession.is_completed) {
      actions.gameCompleted();
    }
  }, [gameSession?.is_completed, gameSession, actions]);

  // Show results when all players have submitted (for joiners who might miss WebSocket notification)
  // But only if we're not showing previous round results and we have submitted players
  useEffect(() => {
    if (allPlayersSubmitted && 
        gameSession && 
        !gameSession.is_completed && 
        playerScoresData && 
        submittedPlayers.size > 0 &&
        !isShowingPreviousRound) {
      actions.setShowResults(true);
    }
  }, [allPlayersSubmitted, gameSession, playerScoresData, submittedPlayers.size, isShowingPreviousRound, actions]);

  // Round change detection and state reset is handled by useRoundManagement hook

  // Refetch scores with totals when game is completed
  useEffect(() => {
    if (gameSession?.is_completed) {
      refetchScores();
    }
  }, [gameSession?.is_completed, refetchScores]);

  // Auto-submit function - submits answers when timer reaches 0
  const handleAutoSubmit = useCallback(() => {
    if (!roomId || !gameSession || isSubmitted) {
      return;
    }

    // Prepare answers - submit whatever is filled, empty strings for unfilled
    const answersToSubmit = {};
    gameSession.selected_types.forEach(type => {
      answersToSubmit[type] = answers[type] || '';
    });

    submitAnswerMutation.mutate(
      { roomId, data: { answers: answersToSubmit } },
      {
        onSuccess: () => {
          actions.setIsSubmitted(true);
          refetchScores();
          // Show notification that auto-submit happened
          showWarning(t('game.timeUpAutoSubmitted'));
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             t('game.failedToAutoSubmit');
          showError(errorMessage);
        }
      }
    );
  }, [roomId, gameSession, isSubmitted, answers, submitAnswerMutation, refetchScores, showWarning, showError, t]);

  // Use game timer hook to manage timer logic and auto-submit
  const remainingSeconds = useGameTimer(gameSession, isSubmitted, handleAutoSubmit);

  // Calculate isHost before early returns (needed for handleReturnToRoom)
  const isHost = user?.id === room?.host_id;

  // Handle return to room - for host: end game session first, for joiners: just navigate
  // Must be defined before early returns to follow React hooks rules
  const handleReturnToRoom = useCallback(() => {
    const storedRoomType = localStorage.getItem('room_type');
    
    if (isHost && gameSession && gameSession.letter) {
      // Host: end the game session first (if game has started), then navigate
      endGameSessionMutation.mutate(roomId, {
        onSuccess: () => {
          // Reset game state
          actions.resetRound();
          // Navigate to host room
          navigate('/host');
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             t('game.failedToEndGameSession');
          showError(errorMessage);
        }
      });
    } else {
      // Joiner or game hasn't started: just navigate
      if (storedRoomType === 'host') {
        navigate('/host');
      } else {
        navigate('/join');
      }
    }
  }, [isHost, gameSession, roomId, endGameSessionMutation, actions, navigate, showError, t]);

  if (isLoadingRoom || !room) {
    return (
      <div className={styles.gameSessionPage}>
        <Text text={t('game.loadingGameSession')} />
      </div>
    );
  }

  const isFirstLoad = !gameSession && isLoadingGameSession;
  if (isFirstLoad) {
    return (
      <div className={styles.gameSessionPage}>
        <Text text={t('game.loadingGameData')} />
      </div>
    );
  }

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
    // If user starts typing in a new round, hide the previous round's results and refetch scores
    if (!isSubmitted && showResults && value.trim().length > 0) {
      actions.setShowResults(false);
      clearPreviousRoundData();
      refetchScores();
    }
    
    // Always update the answer value (allow typing)
    actions.updateAnswer(gameType, value);
    
    // Validate using the hook
    const error = validateAnswer(value);
    actions.updateValidationError(gameType, error);
  };

  const handleSubmit = () => {
    if (!roomId || !gameSession) return;

    // Check for validation errors
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      showError(t('game.fixValidationErrors'));
      return;
    }

    // Validate all answers one more time before submission using the hook
    const isValid = validateAllAnswers(answers, gameSession.selected_types);
    if (!isValid) {
      showError(t('game.someAnswersInvalid'));
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
          actions.setIsSubmitted(true);
          refetchScores();
          showSuccess(t('game.answersSubmittedSuccessfully'));
        },
        onError: (error) => {
          const errorMessage = error.response?.data?.error || 
                             error.response?.data?.detail ||
                             t('game.failedToSubmitAnswers');
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
        <GameCompleted
          players={players}
          playerScores={playerScores}
          playerScoresData={playerScoresData}
          onReturnToRoom={handleReturnToRoom}
          isEndingGameSession={endGameSessionMutation.isPending}
          t={t}
        />
      ) : gameSession && !gameSession.is_completed ? (
        <>
          {/* Top Bar: Letter (left), Rounds & Timer (center), Players (right) */}
          <div className={styles.topBar}>
            {/* Letter Display - Left */}
            <div className={styles.letterCard}>
              <div className={styles.letterLabel}>{t('game.letterLabel')}</div>
              <div className={styles.letterValue}>{finalLetter || '?'}</div>
            </div>

            {/* Center Column - Rounds (top) and Timer/Next Round Button (bottom) */}
            <div className={styles.centerColumn}>
              {/* Round Info - Top */}
              {gameSession.total_rounds > 1 && (
                <div className={styles.roundInfo}>
                  {t('game.roundInfo', { current: gameSession.current_round, total: gameSession.total_rounds })}
                </div>
              )}

              {/* Timer Display - Bottom (only show when NOT showing results) */}
              {!(showResults || allPlayersSubmitted) && (
                <GameTimer remainingSeconds={remainingSeconds} />
              )}

              {/* Next Round / See Results Button - Bottom (only show when results are showing and user is host) */}
              {(showResults || allPlayersSubmitted) && isHost && !gameSession.is_completed && (
                <div className={styles.nextRoundButtonCard}>
                  {(() => {
                    if (showSeeResults) {
                      // See Results button for last round or single round - advance round to complete game
                      return (
                        <Button 
                          onButtonClick={() => {
                            // Advance round on last round will complete the game and show winner statistics
                            advanceRoundMutation.mutate(roomId, {
                              onSuccess: () => {
                                refetchGameSession();
                                refetchScores();
                                // The game should now be completed and show winner statistics
                              },
                              onError: (error) => {
                                const errorMessage = error.response?.data?.error || 
                                                   error.response?.data?.detail ||
                                                   t('game.failedToAdvanceRound');
                                showError(errorMessage);
                              }
                            });
                          }}
                          disabled={advanceRoundMutation.isPending}
                          variant="playful"
                          fullWidth
                        >
                          {advanceRoundMutation.isPending ? t('game.showingResults') : t('game.seeResults')}
                        </Button>
                      );
                    } else {
                      // Next Round button for intermediate rounds
                      return (
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
                                                   t('game.failedToAdvanceRound');
                                showError(errorMessage);
                              }
                            });
                          }}
                          disabled={advanceRoundMutation.isPending}
                          variant="playful"
                          fullWidth
                        >
                          {advanceRoundMutation.isPending ? t('game.advancing') : t('game.nextRound')}
                        </Button>
                      );
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Players Display - Right */}
            <PlayerList
              players={players}
              playerScores={playerScores}
              submittedPlayers={submittedPlayers}
              room={room}
              formatPointsDisplay={formatPointsDisplay}
            />
          </div>

          {/* Categories Section - Show when time is active, hide when results show */}
          {!(showResults || allPlayersSubmitted) && gameSession && gameSession.selected_types && gameSession.selected_types.length > 0 && displayTypes.length > 0 && (
            <AnswerForm
              displayTypes={displayTypes}
              selectedTypes={gameSession.selected_types}
              letter={finalLetter}
              answers={answers}
              validationErrors={validationErrors}
              onAnswerChange={handleAnswerChange}
              onSubmit={handleSubmit}
              isSubmitted={isSubmitted}
              isSubmitting={submitAnswerMutation.isPending}
              allPlayersSubmitted={allPlayersSubmitted}
            />
          )}

          {/* Results Table - Show when time is up or all players submitted */}
          {(showResults || allPlayersSubmitted) && gameSession && gameSession.selected_types && displayTypes.length > 0 && (
            <ResultsTable
              displayTypes={displayTypes}
              selectedTypes={gameSession.selected_types}
              players={players}
              playerScores={playerScores}
              room={room}
              getPlayerAnswer={getPlayerAnswer}
              getPlayerPointsForCategory={getPlayerPointsForCategory}
              getPlayerTotalPoints={getPlayerTotalPoints}
              formatPointsDisplay={formatPointsDisplay}
            />
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {isHost && (
              <Button 
                onButtonClick={() => navigate(`/host/rules/${room.id}`)}
                variant="playful"
                size="small"
              >
                {t('game.configureRules')}
              </Button>
            )}
            <Button 
              onButtonClick={handleReturnToRoom}
              disabled={endGameSessionMutation.isPending}
              variant="warning"
              size="small"
            >
              {endGameSessionMutation.isPending ? t('game.endingGameSession') : t('game.backToRoom')}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}>{t('game.loading')}</div>
          <p className={styles.loadingText}>{t('game.loadingGameSession')}</p>
        </div>
      )}
    </div>
  );
}
