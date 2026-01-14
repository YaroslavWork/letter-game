import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage/MainPage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={ <MainPage /> } />
      <Route path="/login" element={ <LoginPage /> } />
      <Route path="/register" element={ <RegisterPage /> } />
      <Route path="*" element={ <NotFoundPage /> } />
    </Routes>
  );
}

export default App;
