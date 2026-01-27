import { useReducer, useCallback } from 'react';

// Action types
export const GAME_ACTIONS = {
  SET_ROOM: 'SET_ROOM',
  SET_PLAYERS: 'SET_PLAYERS',
  SET_GAME_SESSION: 'SET_GAME_SESSION',
  UPDATE_GAME_SESSION: 'UPDATE_GAME_SESSION',
  SET_ANSWERS: 'SET_ANSWERS',
  UPDATE_ANSWER: 'UPDATE_ANSWER',
  SET_IS_SUBMITTED: 'SET_IS_SUBMITTED',
  ADD_SUBMITTED_PLAYER: 'ADD_SUBMITTED_PLAYER',
  SET_SUBMITTED_PLAYERS: 'SET_SUBMITTED_PLAYERS',
  SET_VALIDATION_ERRORS: 'SET_VALIDATION_ERRORS',
  UPDATE_VALIDATION_ERROR: 'UPDATE_VALIDATION_ERROR',
  CLEAR_VALIDATION_ERROR: 'CLEAR_VALIDATION_ERROR',
  SET_SHOW_RESULTS: 'SET_SHOW_RESULTS',
  RESET_ROUND: 'RESET_ROUND',
  RESET_FORM: 'RESET_FORM',
  GAME_COMPLETED: 'GAME_COMPLETED',
  NEW_GAME_SESSION: 'NEW_GAME_SESSION'
};

// Initial state
const initialState = {
  room: null,
  players: [],
  gameSession: null,
  answers: {},
  isSubmitted: false,
  submittedPlayers: new Set(),
  validationErrors: {},
  showResults: false,
  isGameCompleted: false,
  previousGameSessionId: null
};

// Reducer function
function gameStateReducer(state, action) {
  switch (action.type) {
    case GAME_ACTIONS.SET_ROOM:
      return {
        ...state,
        room: action.payload
      };

    case GAME_ACTIONS.SET_PLAYERS:
      return {
        ...state,
        players: action.payload
      };

    case GAME_ACTIONS.SET_GAME_SESSION:
      return {
        ...state,
        gameSession: action.payload,
        isGameCompleted: action.payload?.is_completed || false
      };

    case GAME_ACTIONS.UPDATE_GAME_SESSION:
      // Smart update that preserves important state
      const newSession = action.payload;
      const isNewSession = state.gameSession && newSession && newSession.id !== state.gameSession.id;
      const wasCompleted = state.isGameCompleted;
      
      // If this is a new game session after completion, reset state
      if (wasCompleted && isNewSession) {
        return {
          ...state,
          gameSession: newSession,
          isGameCompleted: newSession?.is_completed || false,
          answers: {},
          isSubmitted: false,
          validationErrors: {},
          submittedPlayers: new Set(),
          showResults: false,
          previousGameSessionId: state.gameSession?.id || null
        };
      }
      
      return {
        ...state,
        gameSession: newSession,
        isGameCompleted: newSession?.is_completed || false,
        // If game session is completed, mark it
        ...(newSession?.is_completed && {
          showResults: true,
          isGameCompleted: true
        })
      };

    case GAME_ACTIONS.SET_ANSWERS:
      return {
        ...state,
        answers: action.payload
      };

    case GAME_ACTIONS.UPDATE_ANSWER:
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.key]: action.payload.value
        }
      };

    case GAME_ACTIONS.SET_IS_SUBMITTED:
      return {
        ...state,
        isSubmitted: action.payload
      };

    case GAME_ACTIONS.ADD_SUBMITTED_PLAYER:
      return {
        ...state,
        submittedPlayers: new Set([...state.submittedPlayers, action.payload])
      };

    case GAME_ACTIONS.SET_SUBMITTED_PLAYERS:
      return {
        ...state,
        submittedPlayers: action.payload instanceof Set 
          ? action.payload 
          : new Set(action.payload)
      };

    case GAME_ACTIONS.SET_VALIDATION_ERRORS:
      return {
        ...state,
        validationErrors: action.payload
      };

    case GAME_ACTIONS.UPDATE_VALIDATION_ERROR:
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.payload.key]: action.payload.error
        }
      };

    case GAME_ACTIONS.CLEAR_VALIDATION_ERROR:
      const newErrors = { ...state.validationErrors };
      delete newErrors[action.payload];
      return {
        ...state,
        validationErrors: newErrors
      };

    case GAME_ACTIONS.SET_SHOW_RESULTS:
      return {
        ...state,
        showResults: action.payload
      };

    case GAME_ACTIONS.RESET_ROUND:
      // Reset form state for new round
      return {
        ...state,
        answers: {},
        isSubmitted: false,
        validationErrors: {},
        submittedPlayers: new Set(),
        showResults: false
      };

    case GAME_ACTIONS.RESET_FORM:
      // Reset only form-related state
      return {
        ...state,
        answers: {},
        validationErrors: {}
      };

    case GAME_ACTIONS.GAME_COMPLETED:
      return {
        ...state,
        isGameCompleted: true,
        showResults: true
      };

    case GAME_ACTIONS.NEW_GAME_SESSION:
      // When a new game session starts after completion
      return {
        ...state,
        gameSession: action.payload,
        isGameCompleted: false,
        answers: {},
        isSubmitted: false,
        validationErrors: {},
        submittedPlayers: new Set(),
        showResults: false,
        previousGameSessionId: state.gameSession?.id || null
      };

    default:
      return state;
  }
}

/**
 * Custom hook to manage game state using useReducer
 * 
 * @returns {Object} Game state and dispatch function
 */
export const useGameState = () => {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);

  // Action creators for convenience
  const actions = {
    setRoom: useCallback((room) => {
      dispatch({ type: GAME_ACTIONS.SET_ROOM, payload: room });
    }, []),

    setPlayers: useCallback((players) => {
      dispatch({ type: GAME_ACTIONS.SET_PLAYERS, payload: players });
    }, []),

    setGameSession: useCallback((gameSession) => {
      dispatch({ type: GAME_ACTIONS.SET_GAME_SESSION, payload: gameSession });
    }, []),

    updateGameSession: useCallback((gameSession) => {
      dispatch({ type: GAME_ACTIONS.UPDATE_GAME_SESSION, payload: gameSession });
    }, []),

    setAnswers: useCallback((answers) => {
      dispatch({ type: GAME_ACTIONS.SET_ANSWERS, payload: answers });
    }, []),

    updateAnswer: useCallback((key, value) => {
      dispatch({ type: GAME_ACTIONS.UPDATE_ANSWER, payload: { key, value } });
    }, []),

    setIsSubmitted: useCallback((isSubmitted) => {
      dispatch({ type: GAME_ACTIONS.SET_IS_SUBMITTED, payload: isSubmitted });
    }, []),

    addSubmittedPlayer: useCallback((username) => {
      dispatch({ type: GAME_ACTIONS.ADD_SUBMITTED_PLAYER, payload: username });
    }, []),

    setSubmittedPlayers: useCallback((players) => {
      dispatch({ type: GAME_ACTIONS.SET_SUBMITTED_PLAYERS, payload: players });
    }, []),

    setValidationErrors: useCallback((errors) => {
      dispatch({ type: GAME_ACTIONS.SET_VALIDATION_ERRORS, payload: errors });
    }, []),

    updateValidationError: useCallback((key, error) => {
      if (error) {
        dispatch({ type: GAME_ACTIONS.UPDATE_VALIDATION_ERROR, payload: { key, error } });
      } else {
        dispatch({ type: GAME_ACTIONS.CLEAR_VALIDATION_ERROR, payload: key });
      }
    }, []),

    setShowResults: useCallback((show) => {
      dispatch({ type: GAME_ACTIONS.SET_SHOW_RESULTS, payload: show });
    }, []),

    resetRound: useCallback(() => {
      dispatch({ type: GAME_ACTIONS.RESET_ROUND });
    }, []),

    resetForm: useCallback(() => {
      dispatch({ type: GAME_ACTIONS.RESET_FORM });
    }, []),

    gameCompleted: useCallback(() => {
      dispatch({ type: GAME_ACTIONS.GAME_COMPLETED });
    }, []),

    newGameSession: useCallback((gameSession) => {
      dispatch({ type: GAME_ACTIONS.NEW_GAME_SESSION, payload: gameSession });
    }, [])
  };

  return {
    state,
    dispatch,
    actions
  };
};
