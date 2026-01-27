import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage round state, transitions, and previous round scores
 * 
 * @param {Object} gameSession - The current game session object
 * @param {Object} playerScoresData - Player scores data from API
 * @param {Function} refetchScores - Function to refetch scores
 * @param {Function} onRoundChange - Callback when round changes (receives reset functions)
 * @returns {Object} Round management state and helpers
 */
export const useRoundManagement = (gameSession, playerScoresData, refetchScores, onRoundChange) => {
  const [previousRoundScores, setPreviousRoundScores] = useState(null);
  const [previousRoundNumber, setPreviousRoundNumber] = useState(null);
  const prevRoundRef = useRef(null);

  // Handle round change detection and state reset
  useEffect(() => {
    if (gameSession && gameSession.current_round) {
      const currentRound = gameSession.current_round;
      const prevRound = prevRoundRef.current;
      
      // Only reset if round actually changed (not on initial load)
      if (prevRound !== null && prevRound !== currentRound) {
        // Store current scores as previous round scores before they're cleared
        const currentScoresResponse = playerScoresData?.data || playerScoresData || {};
        const currentPlayerScores = Array.isArray(currentScoresResponse) 
          ? currentScoresResponse 
          : (currentScoresResponse.round_scores || []);
        
        if (currentPlayerScores.length > 0) {
          setPreviousRoundScores(currentPlayerScores);
          setPreviousRoundNumber(prevRound);
        }
        
        // Call the round change callback with reset functions
        if (onRoundChange) {
          onRoundChange();
        }
        
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
  }, [gameSession?.current_round, gameSession, playerScoresData, refetchScores, onRoundChange]);

  // Handle round advancement from WebSocket updates
  const handleRoundAdvancement = useCallback((oldRound, newRound, currentPlayerScores) => {
    if (oldRound && newRound !== oldRound) {
      if (currentPlayerScores.length > 0) {
        setPreviousRoundScores(currentPlayerScores);
        setPreviousRoundNumber(oldRound);
        
        // Clear previous round scores after a brief delay
        setTimeout(() => {
          setPreviousRoundScores(null);
          setPreviousRoundNumber(null);
        }, 1000);
      }
      
      // Trigger round change callback
      if (onRoundChange) {
        onRoundChange();
      }
      
      // Refetch scores for the new round
      refetchScores();
      
      return true; // Round advanced
    }
    return false; // Round didn't advance
  }, [onRoundChange, refetchScores]);

  // Clear previous round data (useful when user starts typing in new round)
  const clearPreviousRoundData = useCallback(() => {
    setPreviousRoundScores(null);
    setPreviousRoundNumber(null);
  }, []);

  // Get player scores (current or previous round if showing results)
  const getPlayerScores = useCallback(() => {
    const scoresResponse = playerScoresData?.data || playerScoresData || {};
    let playerScores = Array.isArray(scoresResponse) 
      ? scoresResponse 
      : (scoresResponse.round_scores || []);
    
    // If we're showing previous round results, use those scores instead
    if (previousRoundScores && previousRoundNumber && gameSession?.current_round !== previousRoundNumber) {
      playerScores = previousRoundScores;
    } else if (playerScores.length > 0 && !previousRoundScores && gameSession?.current_round) {
      // Store current scores as previous round scores when they're available and we don't have stored scores
      setPreviousRoundScores(playerScores);
      setPreviousRoundNumber(gameSession.current_round);
    }
    
    return playerScores;
  }, [playerScoresData, previousRoundScores, previousRoundNumber, gameSession?.current_round]);

  // Check if it's the last round
  const isLastRound = gameSession?.current_round === gameSession?.total_rounds;
  
  // Check if it's a single round game
  const isSingleRound = gameSession?.total_rounds === 1;
  
  // Check if we should show "See Results" button (last round or single round)
  const showSeeResults = isLastRound || isSingleRound;

  return {
    previousRoundScores,
    previousRoundNumber,
    handleRoundAdvancement,
    clearPreviousRoundData,
    getPlayerScores,
    isLastRound,
    isSingleRound,
    showSeeResults
  };
};
