import { useLanguage } from '../../../contexts/LanguageContext';
import styles from './PlayerList.module.css';

/**
 * PlayerList component displays the list of players with their status and scores
 * 
 * @param {Object} props
 * @param {Array<Object>} players - Array of player objects
 * @param {Array<Object>} playerScores - Array of player score objects
 * @param {Set<string>} submittedPlayers - Set of usernames who have submitted
 * @param {Object} room - Room object (to check host_id)
 * @param {Function} formatPointsDisplay - Function to format points display (round/total)
 */
export default function PlayerList({
  players,
  playerScores,
  submittedPlayers,
  room,
  formatPointsDisplay
}) {
  const { t } = useLanguage();

  if (!players || players.length === 0) {
    return null;
  }

  return (
    <div className={styles.playersCard}>
      <div className={styles.playersLabel}>{t('game.players')}</div>
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
                {player.user_id === room.host_id && <span className={styles.hostIcon}>{t('host.host')}</span>}
              </span>
              {hasSubmitted && <span className={styles.submittedIcon}>{t('game.submitted')}</span>}
              <span className={styles.pointsBadge}>{formatPointsDisplay(roundPoints, player.id)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
