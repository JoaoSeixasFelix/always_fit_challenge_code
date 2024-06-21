import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:8000', // URL base do seu backend Laravel
  timeout: 10000, // Tempo limite de 10 segundos (opcional)
  headers: {
    'Content-Type': 'application/json',
    
  },
  withCredentials: true, // Configuração para lidar com CORS
  crossDomain: true, // Configuração para lidar com CORS
});

export default instance;