import { useLanguage } from '../../../contexts/LanguageContext';
import styles from './GameTimer.module.css';

/**
 * GameTimer component displays the remaining time for the current round
 * 
 * @param {number|null} remainingSeconds - The remaining seconds in the timer, or null if timer is not active
 */
export default function GameTimer({ remainingSeconds }) {
  const { t } = useLanguage();

  if (remainingSeconds === null) {
    return null;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className={styles.timerCard}>
      <div className={styles.timerLabel}>{t('game.time')}</div>
      <div className={styles.timerValue}>{formattedTime}</div>
    </div>
  );
}
