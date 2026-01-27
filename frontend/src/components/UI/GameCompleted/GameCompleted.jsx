import Header from '../Header/Header';
import Button from '../Button/Button';
import styles from './GameCompleted.module.css';

export default function GameCompleted({ 
  players, 
  playerScores, 
  playerScoresData, 
  onReturnToRoom, 
  isEndingGameSession,
  t 
}) {
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
      const playerScore = playerScores.find(ps => 
        ps.player === player.id || 
        ps.player_username === player.username
      );
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
    <div className={styles.gameCompleted}>
      <div className={styles.winnerSection}>
        <div className={styles.winnerAnnouncement}>
          <Header text={t('game.gameCompleted')} variant="playful" />
          <p className={styles.winnerSubtitle}>{t('game.finalResults')}</p>
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
          <Header text={t('game.allPlayers')} variant="playful" />
          <div className={styles.statsTable}>
            <table className={styles.statisticsTable}>
              <thead>
                <tr>
                  <th>{t('game.rank')}</th>
                  <th>{t('game.player')}</th>
                  <th>{t('game.total')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, index) => (
                  <tr key={player.id} className={index < 3 ? styles.topThreeRow : ''}>
                    <td className={styles.rankCell}>
                      {index + 1}
                      {index === 0 && <span className={styles.rankBadge}>{t('game.rank1st')}</span>}
                      {index === 1 && <span className={styles.rankBadge}>{t('game.rank2nd')}</span>}
                      {index === 2 && <span className={styles.rankBadge}>{t('game.rank3rd')}</span>}
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
            onButtonClick={onReturnToRoom}
            disabled={isEndingGameSession}
            variant="playful"
            fullWidth
          >
            {isEndingGameSession ? t('game.endingGameSession') : t('game.returnToRoom')}
          </Button>
        </div>
      </div>
    </div>
  );
}
