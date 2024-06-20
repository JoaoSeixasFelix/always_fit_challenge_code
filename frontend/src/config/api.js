import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:8000/', // Exemplo de URL base do backend Laravel
});

export default instance;