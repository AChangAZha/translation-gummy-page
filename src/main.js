import {createApp} from 'vue'
import './style.css'
import App from './App.vue'
import axios from 'axios'
import router from './router'

axios.defaults.baseURL = '/api';
const app = createApp(App);
app.use(router)
app.provide('axios', axios);
app.mount('#app');