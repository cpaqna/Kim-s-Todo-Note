import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

type AuthCallback = (user: User | null) => void;

let authCallback: AuthCallback | null = null;

// Demo user for local mode
const DEMO_USER = {
    uid: 'demo-user',
    displayName: 'Demo User',
    email: 'demo@example.com',
    photoURL: null,
} as unknown as User;

export function initAuth(callback: AuthCallback): void {
    authCallback = callback;

    if (!isFirebaseConfigured || !auth) {
        // Local demo mode - auto-login as demo user
        console.log('🔓 Demo mode: auto-logged in as Demo User');
        setTimeout(() => {
            if (authCallback) authCallback(DEMO_USER);
        }, 300);
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (authCallback) {
            authCallback(user);
        }
    });
}

export async function loginWithGoogle(): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
        // Demo mode - just login as demo user
        if (authCallback) authCallback(DEMO_USER);
        return;
    }

    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
            console.error('Login error:', error);
            alert('로그인에 실패했습니다. 다시 시도해 주세요.');
        }
    }
}

export async function logout(): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
        if (authCallback) authCallback(null);
        return;
    }

    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

export function getCurrentUser(): User | null {
    if (!isFirebaseConfigured || !auth) {
        return DEMO_USER;
    }
    return auth.currentUser;
}

export function isDemoMode(): boolean {
    return !isFirebaseConfigured;
}
