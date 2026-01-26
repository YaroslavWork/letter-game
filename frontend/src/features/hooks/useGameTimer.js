import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to manage game timer logic and auto-submit functionality
 * 
 * @param {Object} gameSession - The current game session object
 * @param {boolean} isSubmitted - Whether the user has already submitted answers
 * @param {Function} onAutoSubmit - Callback function to execute when timer reaches 0
 * @returns {number|null} remainingSeconds - The remaining seconds in the timer, or null if timer is not active
 */
export const useGameTimer = (gameSession, isSubmitted, onAutoSubmit) => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const autoSubmittedRef = useRef(false);

  // Reset auto-submit flag when round changes or game completes
  useEffect(() => {
    if (!gameSession || gameSession.is_completed || !gameSession.round_start_time) {
      setRemainingSeconds(null);
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
        // Auto-submit if not already submitted and not already auto-submitted
        if (!isSubmitted && !autoSubmittedRef.current && onAutoSubmit) {
          autoSubmittedRef.current = true;
          onAutoSubmit();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    gameSession?.round_start_time,
    gameSession?.round_timer_seconds,
    gameSession?.current_round,
    gameSession?.is_completed,
    isSubmitted,
    onAutoSubmit
  ]);

  return remainingSeconds;
};
