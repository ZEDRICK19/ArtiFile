import api from './api.js';
import { setMe, clearMe } from './store.js';
import { navigate } from './router.js';
import { toast } from './ui.js';

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Clear locally even if the server call fails.
  }
  clearMe();
  toast('You have been logged out successfully.');
  await navigate('/login', { replace: true });
}

export async function login(email, password, rememberMe = false) {
  const response = await api.post('/auth/login', { email, password, rememberMe });
  setMe(response.data);
  return response.data;
}

export async function register(payload) {
  const response = await api.post('/auth/register', payload);
  setMe(response.data);
  return response.data;
}

export function homePathFor(session) {
  if (!session) return '/login';
  const role = session.user ? session.user.role : session.role;
  return role === 'ADMIN' ? '/admin' : '/student';
}
