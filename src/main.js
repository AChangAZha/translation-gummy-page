import {createApp} from 'vue'
import './style.css'
import App from './App.vue'
import axios from 'axios'
import router from './router'

axios.defaults.baseURL = import.meta.env.VITE_API_URL;
const app = createApp(App);
app.use(router)
app.provide('axios', axios);
app.mount('#app');