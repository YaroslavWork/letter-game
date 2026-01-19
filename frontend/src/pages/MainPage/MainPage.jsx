import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { wsClient } from '../../lib/websocket';
import Button from '../../components/UI/Button/Button';
import Text from '../../components/UI/Text/Text';
import Header from '../../components/UI/Header/Header';
import styles from './MainPage.module.css'

export default function MainPage () {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const [hasStoredRoom, setHasStoredRoom] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);

    useEffect(() => {
        if (!isAuthenticated && !isLoading) {
            navigate('/login');
        }
    }, [isAuthenticated, isLoading, navigate]);

    // Check for stored room info on mount and when component becomes visible
    const checkStoredRoom = () => {
        const roomId = localStorage.getItem('room_id');
        const roomType = localStorage.getItem('room_type');
        setHasStoredRoom(!!(roomId && roomType));
    };

    useEffect(() => {
        checkStoredRoom();
        
        // Re-check when window gains focus (user might have cleared storage in another tab)
        const handleFocus = () => {
            checkStoredRoom();
        };
        
        window.addEventListener('focus', handleFocus);
        
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const handleReconnect = () => {
        const roomId = localStorage.getItem('room_id');
        const roomType = localStorage.getItem('room_type');
        const token = localStorage.getItem('access_token');

        if (!roomId || !roomType || !token) {
            alert('No room information found. Please host or join a room first.');
            // Clear invalid room info
            localStorage.removeItem('room_id');
            localStorage.removeItem('room_type');
            setHasStoredRoom(false);
            return;
        }

        setIsReconnecting(true);

        // Set up a one-time listener to handle connection
        let timeoutId = null;
        let isHandled = false;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            wsClient.off('open', handleOpen);
            wsClient.off('error', handleError);
            wsClient.off('close', handleClose);
        };

        const handleOpen = () => {
            if (isHandled) return;
            isHandled = true;
            setIsReconnecting(false);
            cleanup();
            // Navigate to the appropriate page based on room type
            if (roomType === 'host') {
                navigate('/host');
            } else if (roomType === 'join') {
                navigate('/join');
            }
        };

        const handleError = () => {
            if (isHandled) return;
            isHandled = true;
            setIsReconnecting(false);
            cleanup();
            alert('Failed to reconnect to the room. The room may no longer exist.');
            // Clear invalid room info
            localStorage.removeItem('room_id');
            localStorage.removeItem('room_type');
            setHasStoredRoom(false);
        };

        const handleClose = (data) => {
            // If connection closes immediately, it might mean the room doesn't exist
            if (!isHandled && data.code !== 1000) {
                isHandled = true;
                setIsReconnecting(false);
                cleanup();
                alert('Failed to reconnect to the room. The room may no longer exist.');
                // Clear invalid room info
                localStorage.removeItem('room_id');
                localStorage.removeItem('room_type');
                setHasStoredRoom(false);
            }
        };

        wsClient.on('open', handleOpen);
        wsClient.on('error', handleError);
        wsClient.on('close', handleClose);

        // Reconnect to WebSocket
        wsClient.connect(roomId, token);

        // Timeout after 5 seconds
        timeoutId = setTimeout(() => {
            if (!isHandled) {
                isHandled = true;
                setIsReconnecting(false);
                cleanup();
                alert('Connection timeout. Please try again.');
            }
        }, 5000);
    };

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
            
            {hasStoredRoom && (
                <div className={styles.reconnectSection}>
                    <Text text="You have an active room session" />
                    <Button 
                        onButtonClick={handleReconnect}
                        disabled={isReconnecting}
                    >
                        {isReconnecting ? 'Reconnecting...' : 'Reconnect to Room'}
                    </Button>
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
                // Clear room info on logout
                localStorage.removeItem('room_id');
                localStorage.removeItem('room_type');
                wsClient.disconnect();
                navigate('/login');
            }}>
                Logout
            </Button>
        </div>
    )
}