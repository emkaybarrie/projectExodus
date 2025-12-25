import { auth } from '../../core/firestore.js';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export const authFeature = {
  id: 'auth',
  api: {
    getUser() { return auth.currentUser; },

    watch(cb) {
      if (typeof cb !== 'function') throw new Error('auth.watch requires callback');
      return onAuthStateChanged(auth, cb);
    },

    async logout() { return signOut(auth); },

    async signInEmail(email, password) {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    },

    async signUpEmail(email, password) {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      return user;
    },

  }
};

export default authFeature;
