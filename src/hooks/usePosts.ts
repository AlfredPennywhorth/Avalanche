import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/firebase';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from 'firebase/firestore';

const PAGE_SIZE = 10;

export interface Post {
    id: string;
    [key: string]: any;
}

export function usePosts(uid: string | undefined) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

    // ── Listener em tempo real apenas para os 10 posts mais recentes ──────────
    useEffect(() => {
        if (!uid) return;

        const q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE)
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                if (snap.empty) {
                    setPosts([]);
                    setHasMore(false);
                    return;
                }
                // Salva o último documento visível para paginação
                lastVisibleRef.current = snap.docs[snap.docs.length - 1];
                const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[];
                // Mantém posts extras (carregados via loadMore) que vêm depois do limit(10)
                setPosts(prev => {
                    const existingIds = new Set(fetched.map(p => p.id));
                    const extra = prev.filter(p => !existingIds.has(p.id));
                    return [...fetched, ...extra];
                });
                setHasMore(snap.docs.length === PAGE_SIZE);
            },
            (error) => {
                console.error('Posts snapshot error:', error);
            }
        );

        return () => unsub();
    }, [uid]);

    // ── Carrega mais posts via getDocs (sem listener permanente) ─────────────
    const loadMore = useCallback(async () => {
        if (!uid || loadingMore || !hasMore || !lastVisibleRef.current) return;
        setLoadingMore(true);

        try {
            const q = query(
                collection(db, 'posts'),
                orderBy('createdAt', 'desc'),
                startAfter(lastVisibleRef.current),
                limit(PAGE_SIZE)
            );
            const snap = await getDocs(q);

            if (snap.empty || snap.docs.length < PAGE_SIZE) {
                setHasMore(false);
            }

            if (!snap.empty) {
                lastVisibleRef.current = snap.docs[snap.docs.length - 1];
                const more = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[];
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...more.filter(p => !existingIds.has(p.id))];
                });
            }
        } catch (error) {
            console.error('loadMore error:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [uid, loadingMore, hasMore]);

    return { posts, hasMore, loadingMore, loadMore };
}
