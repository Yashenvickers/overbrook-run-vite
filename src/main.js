import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Game } from './game/Game.js';

registerSW({ immediate: true });

const app = document.querySelector('#app');
const game = new Game(app);
game.mount();

window.addEventListener('beforeunload', () => game.destroy());
