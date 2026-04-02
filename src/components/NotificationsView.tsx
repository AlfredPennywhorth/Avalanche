import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';

interface NotificationsViewProps {
    user: any;
}

const NotificationsView: React.FC<NotificationsViewProps> = ({ user }) => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;
        
        // Query com ordenação (requer índice composto: recipientUid ASC, createdAt DESC)
        const qWithOrder = query(
            collection(db, 'notifications'),
            where('recipientUid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        // Fallback: Query simples sem ordenação (não requer índice composto)
        const qSimple = query(
            collection(db, 'notifications'),
            where('recipientUid', '==', user.uid),
            limit(20)
        );

        let unsub = onSnapshot(
            qWithOrder,
            (snap) => {
                setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            },
            (error) => {
                console.warn('Notifications query WITH ORDER failed (likely missing index):', error);
                // Tentativa com query simples
                onSnapshot(qSimple, (snap) => {
                    // Ordenar manualmente no cliente como alternativa temporária
                    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setNotifications(docs);
                    setLoading(false);
                }, (err2) => {
                    console.error('Simple notifications query also failed:', err2);
                    setLoading(false);
                });
            }
        );
        return () => unsub();
    }, [user?.uid]);

    const formatTime = (ts: any): string => {
        try {
            const date = ts?.toDate?.();
            if (!date || isNaN(date.getTime())) return 'Just now';
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        } catch {
            return 'Just now';
        }
    };

    return (
        <div className="fade-in" style={{ height: '100%', overflowY: 'auto', padding: '24px', paddingBottom: '100px' }}>
            <h2 className="text-glacial" style={{ marginBottom: '20px' }}>Alerts ❄️</h2>
            {loading ? (
                <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                    <span className="material-symbols-outlined animation-spin">ac_unit</span>
                </div>
            ) : notifications.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.5 }}>Everything is chill here. 🧊</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {notifications.map(n => (
                        <div
                            key={n.id}
                            className={`frosted ${!n.read ? 'neon-border' : ''}`}
                            style={{ padding: '16px', borderRadius: '16px', opacity: n.read ? 0.7 : 1 }}
                            onClick={async () => await updateDoc(doc(db, 'notifications', n.id), { read: true })}
                        >
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: n.senderName === 'Ava' ? 'var(--cyan-neon)' : 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: n.senderName === 'Ava' ? '1px solid var(--cyan-neon)' : 'none' }}>
                                    {n.senderPhoto ? <img src={n.senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (n.senderAvatar || '👤')}
                                </div>
                                <div>
                                    <p style={{ fontSize: '14px' }}>
                                        <strong style={{ color: n.senderName === 'Ava' ? 'var(--cyan-neon)' : 'inherit' }}>{n.senderName}</strong> {n.text}
                                    </p>
                                    <p style={{ fontSize: '10px', opacity: 0.5 }}>{formatTime(n.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsView;
