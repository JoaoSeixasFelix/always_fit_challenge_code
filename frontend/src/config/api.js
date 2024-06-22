import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:8000', // URL base do seu backend Laravel
  timeout: 10000, // Tempo limite de 10 segundos (opcional)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Configuração para lidar com cookies
});

instance.interceptors.request.use(config => {
  const token = document.head.querySelector('meta[name="csrf-token"]');
  if (token) {
    config.headers['X-CSRF-TOKEN'] = token.content;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

export default instance;