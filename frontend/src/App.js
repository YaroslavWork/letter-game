import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage/MainPage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import HostGamePage from './pages/HostGamePage/HostGamePage';
import HostGameRulePage from './pages/HostGameRulePage/HostGameRulePage';
import JoinGamePage from './pages/JoinGamePage/JoinGamePage';
import GameSessionPage from './pages/GameSessionPage/GameSessionPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import NotificationContainer from './components/UI/Notification/NotificationContainer';
import ConfirmationDialog from './components/UI/ConfirmationDialog/ConfirmationDialog';
import './App.css';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={ <MainPage /> } />
        <Route path="/login" element={ <LoginPage /> } />
        <Route path="/register" element={ <RegisterPage /> } />
        <Route path="/host" element={ <HostGamePage /> } />
        <Route path="/host/rules/:roomId" element={ <HostGameRulePage /> } />
        <Route path="/join" element={ <JoinGamePage /> } />
        <Route path="/game/:roomId" element={ <GameSessionPage /> } />
        <Route path="/settings" element={ <SettingsPage /> } />
        <Route path="*" element={ <NotFoundPage /> } />
      </Routes>
      <NotificationContainer />
      <ConfirmationDialog />
    </>
  );
}

export default App;
