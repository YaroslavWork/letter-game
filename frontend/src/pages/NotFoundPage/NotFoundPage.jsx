import { useNavigate } from 'react-router-dom';
import Button from '../../components/UI/Button/Button';
import Header from '../../components/UI/Header/Header';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div>
      <Header text="404 - Page Not Found" />
      <p>The page you're looking for doesn't exist.</p>
      <Button onButtonClick={() => navigate('/')}>
        Go to Home
      </Button>
    </div>
  );
}
