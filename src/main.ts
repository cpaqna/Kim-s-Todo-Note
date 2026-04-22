import './style.css';
import { initAuth, loginWithGoogle, logout, isDemoMode } from './auth';
import { subscribeTodos, unsubscribeTodos, setFilter } from './todo';
import { initCalendar, updateCalendarTodos } from './calendar';
import type { User } from 'firebase/auth';

// ===== DOM Elements =====
const authScreen = document.getElementById('auth-screen') as HTMLElement;
const mainScreen = document.getElementById('main-screen') as HTMLElement;
const googleLoginBtn = document.getElementById('google-login-btn') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLElement;
const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;

const todoTab = document.getElementById('todo-tab') as HTMLElement;
const calendarTab = document.getElementById('calendar-tab') as HTMLElement;
const tabTodoBtn = document.getElementById('tab-todo') as HTMLElement;
const tabCalendarBtn = document.getElementById('tab-calendar') as HTMLElement;


// ===== Auth =====
initAuth((user: User | null) => {
  if (user) {
    showMainScreen(user);
  } else {
    showAuthScreen();
  }
});

googleLoginBtn.addEventListener('click', loginWithGoogle);
logoutBtn.addEventListener('click', () => {
  unsubscribeTodos();
  logout();
});

function showAuthScreen(): void {
  authScreen.classList.add('active');
  mainScreen.classList.remove('active');
}

function showMainScreen(user: User): void {
  authScreen.classList.remove('active');
  mainScreen.classList.add('active');

  // Set user avatar
  if (user.photoURL) {
    userAvatar.src = user.photoURL;
    userAvatar.style.display = 'block';
  } else {
    userAvatar.style.display = 'none';
  }

  // Show demo mode banner if needed
  if (isDemoMode()) {
    showDemoBanner();
  }

  // Subscribe to todos with real-time sync
  subscribeTodos((todos) => {
    updateCalendarTodos(todos);
  });

  // Init calendar
  initCalendar();
}

function showDemoBanner(): void {
  // Check if banner already exists
  if (document.getElementById('demo-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  banner.innerHTML = `
    <span>🔧 데모 모드 — Firebase config를 설정하면 실시간 동기화가 활성화됩니다</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.2rem;padding:0 4px;">✕</button>
  `;
  banner.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(251, 191, 36, 0.1);
    border-bottom: 1px solid rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    font-size: 0.8rem;
    font-family: inherit;
  `;
  const header = document.querySelector('.app-header') as HTMLElement;
  if (header) {
    header.after(banner);
  }
}

// ===== Tab Switching =====
tabTodoBtn.addEventListener('click', () => switchTab('todo'));
tabCalendarBtn.addEventListener('click', () => switchTab('calendar'));

function switchTab(tab: string): void {
  if (tab === 'todo') {
    todoTab.classList.add('active');
    calendarTab.classList.remove('active');
    tabTodoBtn.classList.add('active');
    tabCalendarBtn.classList.remove('active');
  } else {
    calendarTab.classList.add('active');
    todoTab.classList.remove('active');
    tabCalendarBtn.classList.add('active');
    tabTodoBtn.classList.remove('active');
  }
}

// ===== Filters =====
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const filter = target.dataset.filter || 'all';

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    target.classList.add('active');

    setFilter(filter);
  });
});

// ===== Global Countdown Timer =====
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('.countdown-timer').forEach(el => {
    const expiresStr = (el as HTMLElement).dataset.expires;
    if (expiresStr) {
      const val = parseInt(expiresStr, 10);
      const remaining = Math.ceil((val - now) / 1000);
      if (remaining > 0) {
        el.textContent = `(${remaining}초)`;
      } else {
        el.textContent = '';
      }
    }
  });
}, 1000);
