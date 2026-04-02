import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { supabase } from '../services/supabase';
import { doc, updateDoc } from 'firebase/firestore';
import { collection, onSnapshot } from 'firebase/firestore';

const AVATARS = ['🧊', '❄️', '🏔️', '⛄', '🌨️', '🐧', '🦊', '🎭', '🦦', '🐶', '🍕', '🏂', '🎸', '🎮', '🎧', '⚡', '🥑', '🐼', '🐯', '🛸', '🚀', '👽'];
const INTEREST_SUGGESTIONS = ['Slang', 'Games', 'Travels', 'Music', 'Movies', 'Tech', 'Sports', 'Food', 'Memes', 'Fashion', 'Books', 'Science'];
const APP_VERSION = 'v1.5.0';

interface ProfileViewProps {
    user: any;
    allPosts: any[];
    onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, allPosts, onLogout }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photo, setPhoto] = useState<string | null>(user?.photo || null);
    const [avatar, setAvatar] = useState<string>(user?.avatar || '🧊');
    const [showPicker, setShowPicker] = useState(false);
    const [interests, setInterests] = useState<string[]>(user?.interests || []);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        if (user?.photo) setPhoto(user.photo);
        if (user?.avatar) setAvatar(user.avatar);
        if (user?.interests) setInterests(user.interests);
    }, [user]);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;
        setShowPicker(false);
        try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `${user.uid}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw new Error(`Supabase error: ${uploadError.message}`);
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            setPhoto(publicUrl);
            await updateDoc(doc(db, 'users', user.uid), { photo: publicUrl, avatar: null });
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            alert(`Oops! Failed to upload photo: ${error.message} ❄️`);
        }
    };

    const userPosts = allPosts.filter(p => p.authorId === user.uid);

    return (
        <div className="fade-in" style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onLogout} style={{ background: 'rgba(255,75,75,0.1)', border: 'none', color: '#ff6b6b', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer' }}>Sign out</button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
                    <div className="neon-border" style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden' }}>
                        {photo
                            ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>{avatar}</div>
                        }
                    </div>
                </div>
                <h2 style={{ marginTop: '12px' }}>{user.name}</h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '8px' }}>
                    <span className="points-badge" style={{ fontSize: '14px', padding: '6px 16px', boxShadow: '0 0 20px rgba(0,229,255,0.3)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>ac_unit</span>
                        {user.snowPoints || 0} SNOW POINTS
                    </span>
                </div>
                <p style={{ color: 'var(--cyan-neon)', marginTop: '12px' }}>{user.role === 'teacher' ? '🏫 Teacher' : '🧊 Student'} @ {user.school}</p>
            </div>

            {showPicker && (
                <div className="frosted fade-in" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px', zIndex: 5000, borderTop: '2px solid var(--cyan-neon)' }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '12px', background: 'var(--cyan-neon)', border: 'none', borderRadius: '12px', color: '#020817', fontWeight: 700, marginBottom: '16px', cursor: 'pointer' }}>Upload Photo</button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handlePhotoChange} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {AVATARS.map(em => (
                            <div key={em} onClick={async () => {
                                setAvatar(em); setPhoto(null); setShowPicker(false);
                                if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { avatar: em, photo: null });
                            }} style={{ fontSize: '32px', textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', cursor: 'pointer' }}>{em}</div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="frosted" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Contributions</p>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--cyan-neon)' }}>{userPosts.length}</p>
                </div>
                <div className="frosted" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Verified</p>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: '#4CAF50' }}>{userPosts.filter(p => p.verified).length}</p>
                </div>
            </div>

            <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3>Interests</h3>
                    <span onClick={() => setEditMode(!editMode)} style={{ color: 'var(--cyan-neon)', fontSize: '12px', cursor: 'pointer' }}>{editMode ? 'Done' : 'Edit'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {interests.map(i => (
                        <span key={i} style={{ padding: '4px 12px', background: 'rgba(0,229,255,0.1)', borderRadius: '20px', fontSize: '12px', border: '1px solid var(--cyan-neon)' }}>
                            #{i} {editMode && (
                                <span style={{ cursor: 'pointer' }} onClick={async () => {
                                    const next = interests.filter(t => t !== i);
                                    setInterests(next);
                                    if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { interests: next });
                                }}>×</span>
                            )}
                        </span>
                    ))}
                    {editMode && INTEREST_SUGGESTIONS.filter(s => !interests.includes(s)).map(s => (
                        <span key={s} onClick={async () => {
                            const next = [...interests, s];
                            setInterests(next);
                            if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { interests: next });
                        }} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '12px', opacity: 0.5, cursor: 'pointer' }}>+{s}</span>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: '40px', padding: '20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>Avalanche App {APP_VERSION}</p>
                <button
                    onClick={() => {
                        if (window.confirm('Isso irá forçar o carregamento da versão mais recente do Avalanche. Continuar? ❄️')) {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    for (const registration of registrations) registration.unregister();
                                });
                            }
                            if ('caches' in window) {
                                caches.keys().then(names => {
                                    for (const name of names) caches.delete(name);
                                });
                            }
                            setTimeout(() => {
                                window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
                            }, 500);
                        }
                    }}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>update</span>
                    Force App Update
                </button>
            </div>
            <div style={{ height: '80px' }} />
        </div>
    );
};

export default ProfileView;
