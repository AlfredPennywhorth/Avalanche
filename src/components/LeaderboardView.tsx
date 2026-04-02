import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface LeaderboardViewProps {
    user: any;
}

const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user }) => {
    const [rankedUsers, setRankedUsers] = useState<any[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'users'), orderBy('snowPoints', 'desc'), limit(50));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => u.id !== 'ava-ai');
                setRankedUsers(users as any[]);
            },
            (error) => {
                console.error('Leaderboard snapshot error:', error);
            }
        );
        return () => unsub();
    }, []);

    const MEDALS = ['🥇', '🥈', '🥉'];

    return (
        <div
            className="fade-in"
            style={{ height: '100%', overflowY: 'auto', padding: '24px', paddingBottom: '100px' }}
        >
            <h2 className="text-glacial" style={{ marginBottom: '20px' }}>Leaderboard 🏆</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rankedUsers.map((u, i) => {
                    const isMe = u.id === user?.uid;
                    return (
                        <div
                            key={u.id}
                            className={`frosted ${isMe ? 'neon-border' : ''}`}
                            style={{
                                padding: '14px 18px',
                                borderRadius: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                background: isMe ? 'rgba(0,229,255,0.06)' : undefined,
                            }}
                        >
                            <span style={{ fontSize: i < 3 ? '22px' : '14px', fontWeight: 700, minWidth: '30px', textAlign: 'center', color: i < 3 ? 'inherit' : 'var(--text-dim)' }}>
                                {i < 3 ? MEDALS[i] : `#${i + 1}`}
                            </span>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', overflow: 'hidden', flexShrink: 0 }}>
                                {u.photo ? <img src={u.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.avatar || '🧊')}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {u.name || u.email} {isMe && <span style={{ color: 'var(--cyan-neon)', fontSize: '11px' }}>(you)</span>}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.school || 'Avalanche Member'}</p>
                            </div>
                            <div className="points-badge" style={{ fontSize: '12px', padding: '4px 10px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>ac_unit</span>
                                {u.snowPoints || 0}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LeaderboardView;
