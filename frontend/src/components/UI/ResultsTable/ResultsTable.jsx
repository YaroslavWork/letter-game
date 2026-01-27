import { useLanguage } from '../../../contexts/LanguageContext';
import styles from './ResultsTable.module.css';

/**
 * ResultsTable component displays the game results table with player answers and scores
 * 
 * @param {Object} props
 * @param {Array<string>} displayTypes - Display names for the categories
 * @param {Array<string>} selectedTypes - Keys for the selected game types
 * @param {Array<Object>} players - Array of player objects
 * @param {Array<Object>} playerScores - Array of player score objects
 * @param {Object} room - Room object (to check host_id)
 * @param {Function} getPlayerAnswer - Function to get a player's answer for a category
 * @param {Function} getPlayerPointsForCategory - Function to get points for a category
 * @param {Function} getPlayerTotalPoints - Function to get total points for a player
 * @param {Function} formatPointsDisplay - Function to format points display (round/total)
 */
export default function ResultsTable({
  displayTypes,
  selectedTypes,
  players,
  playerScores,
  room,
  getPlayerAnswer,
  getPlayerPointsForCategory,
  getPlayerTotalPoints,
  formatPointsDisplay
}) {
  const { t } = useLanguage();

  if (!displayTypes || displayTypes.length === 0 || !selectedTypes || selectedTypes.length === 0 || !players || players.length === 0) {
    return null;
  }

  return (
    <div className={styles.resultsSection}>
      <h2 className={styles.sectionTitle}>
        {t('game.results')}
      </h2>
      <div className={styles.resultsTable}>
        <table className={styles.answersTable}>
          <thead>
            <tr>
              <th className={styles.tableHeader}>{t('game.category')}</th>
              {players.map((player) => (
                <th key={player.id} className={styles.tableHeader}>
                  {player.game_name || player.username}
                  {player.user_id === room.host_id && <span className={styles.hostIcon}>{t('host.host')}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayTypes.map((type, index) => {
              const gameTypeKey = selectedTypes[index];
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
              <td className={styles.totalCell}>{t('game.roundTotal')}</td>
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
  );
}
