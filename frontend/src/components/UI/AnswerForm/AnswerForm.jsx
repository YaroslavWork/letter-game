import { useLanguage } from '../../../contexts/LanguageContext';
import Button from '../Button/Button';
import styles from './AnswerForm.module.css';

/**
 * AnswerForm component displays the answer input form for game categories
 * 
 * @param {Object} props
 * @param {Array<string>} displayTypes - Display names for the categories
 * @param {Array<string>} selectedTypes - Keys for the selected game types
 * @param {string} letter - The game letter that answers must start with
 * @param {Object} answers - Current answers object (keyed by game type)
 * @param {Object} validationErrors - Validation errors object (keyed by game type)
 * @param {Function} onAnswerChange - Callback when an answer changes
 * @param {Function} onSubmit - Callback when form is submitted
 * @param {boolean} isSubmitted - Whether answers have been submitted
 * @param {boolean} isSubmitting - Whether submission is in progress
 * @param {boolean} allPlayersSubmitted - Whether all players have submitted
 */
export default function AnswerForm({
  displayTypes,
  selectedTypes,
  letter,
  answers,
  validationErrors,
  onAnswerChange,
  onSubmit,
  isSubmitted,
  isSubmitting,
  allPlayersSubmitted
}) {
  const { t } = useLanguage();

  if (!displayTypes || displayTypes.length === 0 || !selectedTypes || selectedTypes.length === 0) {
    return null;
  }

  const finalLetter = letter?.toUpperCase();

  return (
    <div className={styles.categoriesSection}>
      <h2 className={styles.sectionTitle}>
        {t('game.categories')}
      </h2>
      <div className={styles.categoriesGrid}>
        {displayTypes.map((type, index) => {
          const gameTypeKey = selectedTypes[index];
          const error = validationErrors[gameTypeKey];
          const currentValue = answers[gameTypeKey] || '';
          const isValid = !error && (currentValue.trim() === '' || (finalLetter && currentValue.trim()[0].toUpperCase() === finalLetter.toUpperCase()));
          
          return (
            <div key={index} className={styles.categoryCard}>
              <label className={styles.categoryLabel}>{type}</label>
              <input 
                type="text" 
                className={`${styles.categoryInput} ${error ? styles.categoryInputError : ''} ${isValid && currentValue.trim() !== '' ? styles.categoryInputValid : ''}`}
                placeholder={t('game.startWith', { letter: finalLetter || '?' })}
                value={currentValue}
                onChange={(e) => onAnswerChange(gameTypeKey, e.target.value)}
                disabled={isSubmitted}
              />
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}
              {!error && currentValue.trim() !== '' && finalLetter && currentValue.trim()[0].toUpperCase() === finalLetter.toUpperCase() && (
                <div className={styles.successMessage}>
                  {t('game.valid')}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!isSubmitted && (
        <div className={styles.submitSection}>
          <Button 
            onButtonClick={onSubmit}
            disabled={isSubmitting || Object.keys(validationErrors).length > 0}
            variant="playful"
            fullWidth
          >
            {isSubmitting ? t('game.submitting') : t('game.submitAnswers')}
          </Button>
          {Object.keys(validationErrors).length > 0 && (
            <div className={styles.validationWarning}>
              {t('game.fixValidationErrors')}
            </div>
          )}
        </div>
      )}
      {isSubmitted && !allPlayersSubmitted && (
        <div className={styles.waitingMessage}>
          {t('game.answersSubmitted')}
        </div>
      )}
    </div>
  );
}
