import { useNavigate } from 'react-router-dom';
import Button from '../../components/UI/Button/Button';
import styles from './MainPage.module.css'

export default function MainPage () {
    const navigate = useNavigate();

    return (
        <div className={styles.mainPage}>
            <Button text={"Login"} onButtonClick={() => navigate('/login')}></Button>
            <Button text={"Register"} onButtonClick={() => navigate('/register')}></Button>
        </div>
    )
}