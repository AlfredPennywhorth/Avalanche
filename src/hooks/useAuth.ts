import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export interface AppUser {
    uid: string;
    email: string | null;
    name?: string;
    avatar?: string;
    photo?: string | null;
    role?: 'student' | 'teacher';
    school?: string;
    snowPoints?: number;
    interests?: string[];
}

export function useAuth() {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const unsubUser = onSnapshot(
                    userDocRef,
                    (snap) => {
                        const data = snap.data();
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            ...data,
                        } as AppUser);
                    },
                    (error) => {
                        console.error('Firestore user read error:', error);
                        // Fallback: usa dados mínimos do Firebase Auth
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: 'Student',
                            avatar: '🧊',
                            role: 'student',
                        });
                    }
                );
                setLoading(false);
                return () => unsubUser();
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => unsub();
    }, []);

    return { user, loading };
}
