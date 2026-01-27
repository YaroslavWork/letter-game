import { useCallback } from 'react';

/**
 * Custom hook to provide answer form validation helpers
 * 
 * @param {string} letter - The game letter that answers must start with
 * @param {Function} t - Translation function
 * @returns {Object} Validation helpers
 */
export const useAnswerForm = (letter, t) => {
  const validateAnswer = useCallback((value) => {
    const upperLetter = letter?.toUpperCase();
    if (!upperLetter || value.trim().length === 0) {
      return null; // No error for empty input
    }
    
    const firstChar = value.trim()[0].toUpperCase();
    if (firstChar !== upperLetter) {
      return t('game.wordMustStartWith', { letter: upperLetter });
    }
    
    return null; // Valid
  }, [letter, t]);

  const validateAllAnswers = useCallback((answers, selectedTypes) => {
    const upperLetter = letter?.toUpperCase();
    const invalidAnswers = [];
    
    selectedTypes.forEach(type => {
      const answer = answers[type] || '';
      if (answer.trim() !== '' && upperLetter) {
        const firstChar = answer.trim()[0].toUpperCase();
        if (firstChar !== upperLetter) {
          invalidAnswers.push(type);
        }
      }
    });
    
    return invalidAnswers.length === 0;
  }, [letter]);

  return {
    validateAnswer,
    validateAllAnswers
  };
};
