import { createApp } from 'vue';
import App from './App.vue';
import Axios from './config/api'; // Importe o Axios configurado globalmente
import router from './router';

import './index.css';

createApp(App)
  .use(router)
  .provide('$axios', Axios) // Fornecer o Axios para todos os componentes via injeção de dependência
  .mount('#app');