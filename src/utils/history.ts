import { createHashHistory } from 'history';

// Create a hash history instance (uses # in URLs)
// This allows us to access history outside of React components
// Hash routing works better with static hosting and doesn't require server configuration
export const history = createHashHistory();

// Export navigation helpers
export const navigate = (path: string, state?: any) => {
  history.push(path, state);
};

export const replace = (path: string, state?: any) => {
  history.replace(path, state);
};

export const goBack = () => {
  history.back();
};

export const goForward = () => {
  history.forward();
};

export const go = (delta: number) => {
  history.go(delta);
};

export default history;
