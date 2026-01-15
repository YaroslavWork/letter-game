import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage/MainPage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import HostGamePage from './pages/HostGamePage/HostGamePage';
import JoinGamePage from './pages/JoinGamePage/JoinGamePage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={ <MainPage /> } />
      <Route path="/login" element={ <LoginPage /> } />
      <Route path="/register" element={ <RegisterPage /> } />
      <Route path="/host" element={ <HostGamePage /> } />
      <Route path="/join" element={ <JoinGamePage /> } />
      <Route path="*" element={ <NotFoundPage /> } />
    </Routes>
  );
}

export default App;
