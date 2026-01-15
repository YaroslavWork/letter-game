import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './MainPage.module.css'

export default function MainPage () {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading, logout } = useAuth();

    useEffect(() => {
        if (!isAuthenticated && !isLoading) {
            navigate('/login');
        }
    }, [isAuthenticated, isLoading, navigate]);

    if (isLoading) {
        return (
            <div className={styles.mainPage}>
                <Text text="Loading..." />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <div>You are not logged in</div>;
    }

    return (
        <div className={styles.mainPage}>
            <Header text="Panstwa Miasto" />
            
            {user && (
                <div className={styles.userInfo}>
                    <Text text={`Game Name: ${user.game_name || 'N/A'}`} />
                    <Text text={`Email: ${user.email || 'N/A'}`} />
                </div>
            )}
            
            <div className={styles.gameActions}>
                <Button onButtonClick={() => navigate('/host')}>
                    Host Game
                </Button>
                <Button onButtonClick={() => navigate('/join')}>
                    Join Game
                </Button>
            </div>
            
            <Button onButtonClick={() => {
                logout();
                navigate('/login');
            }}>
                Logout
            </Button>
        </div>
    )
}