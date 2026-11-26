import api from './api.js';

let state = {
  me: null,
  checked: false,
  culturalGroups: [],
  resources: null,
  events: []
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export async function loadMe(force = false) {
  if (state.checked && !force) return state.me;
  try {
    const response = await api.get('/auth/me');
    state.me = response.data;
  } catch (error) {
    state.me = null;
  } finally {
    state.checked = true;
    notify();
  }
  return state.me;
}

export function getMe() {
  return state.me;
}

export function setMe(value) {
  state.me = value;
  state.checked = true;
  notify();
}

export function clearMe() {
  state.me = null;
  state.checked = true;
  notify();
}

export function updateMe(patch) {
  state.me = { ...state.me, ...patch };
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadCulturalGroups() {
  try {
    const response = await api.get('/resources/cultural-groups');
    state.culturalGroups = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    state.culturalGroups = [];
  }
  return state.culturalGroups;
}

export function setCulturalGroups(groups) {
  state.culturalGroups = groups;
}

export function getCulturalGroups() {
  return state.culturalGroups;
}

export default { loadMe, getMe, setMe, clearMe, updateMe, subscribe };
