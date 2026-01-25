import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../../components/UI/Button/Button';
import Header from '../../components/UI/Header/Header';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      <Header text={t('notFound.title')} />
      <p>{t('notFound.message')}</p>
      <Button onButtonClick={() => navigate('/')}>
        {t('notFound.goToHome')}
      </Button>
    </div>
  );
}
