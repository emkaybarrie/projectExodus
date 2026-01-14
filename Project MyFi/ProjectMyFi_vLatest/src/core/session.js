const KEY = 'myfi.authed';

export function isAuthed(){
  return localStorage.getItem(KEY) === '1';
}

export function setAuthed(v){
  localStorage.setItem(KEY, v ? '1' : '0');
}

export function clearAuth(){
  localStorage.removeItem(KEY);
}
