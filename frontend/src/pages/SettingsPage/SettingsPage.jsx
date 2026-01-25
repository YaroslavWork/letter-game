import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../../components/UI/Button/Button';
import Header from '../../components/UI/Header/Header';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { language, changeLanguage, t } = useLanguage();

  const handleLanguageChange = (newLanguage) => {
    changeLanguage(newLanguage);
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.decorativeCircle1}></div>
      <div className={styles.decorativeCircle2}></div>
      
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <Header text={t('settings.title')} variant="playful" />
        </div>

        <div className={styles.settingsSection}>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>{t('settings.language')}</label>
            <div className={styles.languageOptions}>
              <button
                className={`${styles.languageButton} ${language === 'english' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('english')}
              >
                {t('settings.english')}
              </button>
              <button
                className={`${styles.languageButton} ${language === 'polish' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('polish')}
              >
                {t('settings.polish')}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button 
            onButtonClick={() => navigate('/')}
            variant="playful"
            fullWidth
          >
            {t('settings.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}
