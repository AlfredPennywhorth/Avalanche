import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from './services/firebase';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    setDoc,
    where,
    limit,
    increment
} from 'firebase/firestore';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { evaluateComment } from './services/gemini';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATARS = ['🧊', '❄️', '🏔️', '⛄', '🌨️', '🐧', '🦊', '🎭'];
const INTEREST_SUGGESTIONS = ['Slang', 'Games', 'Travels', 'Music', 'Movies', 'Tech', 'Sports', 'Food', 'Memes', 'Fashion', 'Books', 'Science'];
const TOPIC_CHIPS = ['Slang 🤙', 'Phrasal Verbs 🔄', 'Grammar 📖', 'Pronunciation 🗣️', 'Memes 😂', 'Idioms 💡', 'Vocabulary 📚'];
const QUICK_EMOJIS = ['❄️', '🧊', '🏔️', '✅', '💡', '🤙', '🔥', '👀', '💬', '⚡'];
const DEMO_POST_ID = 'demo-post-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('@')) {
            return <span key={i} style={{ color: 'var(--cyan-neon)', fontWeight: 600 }}>{part}</span>;
        }
        return part;
    });
};

// ─── App Component ────────────────────────────────────────────────────────────
export default function App() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'home' | 'discover' | 'create' | 'notifications' | 'profile'>('home');

    const [allPosts, setAllPosts] = useState<any[]>([]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                // Get extra profile data if exists
                const userDoc = doc(db, 'users', u.uid);
                onSnapshot(userDoc, (snap) => {
                    const data = snap.data();
                    setUser({ uid: u.uid, email: u.email, ...data });
                });
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setAllPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [user?.uid]);

    const logout = async () => {
        await signOut(auth);
        setView('home');
    };

    if (loading) {
        return (
            <div className="discovery-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '60px', color: 'var(--cyan-neon)', animation: 'spin 2s linear infinite' }}>ac_unit</span>
                    <h2 className="text-glacial" style={{ marginTop: '20px' }}>Avalanche 🏔️</h2>
                </div>
            </div>
        );
    }

    if (!user) {
        return <AuthView />;
    }

    const renderContent = () => {
        switch (view) {
            case 'discover': return <DiscoverView user={user} />;
            case 'create': return <CreatePostView user={user} onExit={() => setView('home')} />;
            case 'notifications': return <NotificationsView user={user} />;
            case 'profile': return <ProfileView user={user} allPosts={allPosts} onLogout={logout} />;
            default: return <HomeFeed user={user} allPosts={allPosts} />;
        }
    };

    return (
        <div className="discovery-screen">
            <header className="header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px' }}>
                <h1 className="text-glacial" style={{ fontSize: '20px', letterSpacing: '2px', fontWeight: 900, cursor: 'pointer' }} onClick={() => setView('home')}>AVALANCHE</h1>
            </header>

            <main style={{ height: 'calc(100vh - 60px)', marginTop: '60px' }}>
                {renderContent()}
            </main>

            {view !== 'create' && (
                <nav className="nav-bar">
                    <div className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
                        <span className="material-symbols-outlined">home</span>
                    </div>
                    <div className={`nav-item ${view === 'discover' ? 'active' : ''}`} onClick={() => setView('discover')}>
                        <span className="material-symbols-outlined">explore</span>
                    </div>
                    <div className="nav-item create-btn" onClick={() => setView('create')}>
                        <span className="material-symbols-outlined">add</span>
                    </div>
                    <div className={`nav-item ${view === 'notifications' ? 'active' : ''}`} onClick={() => setView('notifications')}>
                        <span className="material-symbols-outlined">notifications</span>
                    </div>
                    <div className={`nav-item ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: view === 'profile' ? '1px solid var(--cyan-neon)' : 'none', overflow: 'hidden' }}>
                            {user.photo ? <img src={user.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.avatar || '🧊')}
                        </div>
                    </div>
                </nav>
            )}
        </div>
    );
}

// ─── AuthView ─────────────────────────────────────────────────────────────────
const AuthView = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [school, setSchool] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'register') {
                if (password !== confirmPassword) throw new Error("Passwords do not match! ❄️");
                const res = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', res.user.uid), {
                    name,
                    school,
                    role,
                    avatar: '🧊',
                    snowPoints: 0,
                    createdAt: serverTimestamp(),
                    interests: ['Slang', 'Games', 'Travels', 'Music']
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '12px', padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none' };

    return (
        <div className="discovery-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="frosted ice-texture" style={{ width: '100%', maxWidth: '380px', padding: '32px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '64px', height: '64px', background: 'var(--bg-card)', borderRadius: '20px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--cyan-neon)', boxShadow: '0 0 15px rgba(0,229,255,0.2)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--cyan-neon)' }}>ac_unit</span>
                    </div>
                    <h1 className="text-glacial" style={{ fontSize: '24px' }}>Avalanche</h1>
                    <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '4px' }}>{mode === 'login' ? 'Welcome back, student!' : 'Join the snow community!'}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '15px' }}>
                    <button onClick={() => setMode('login')} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: mode === 'login' ? 'rgba(0,229,255,0.1)' : 'transparent', color: mode === 'login' ? 'var(--cyan-neon)' : 'var(--text-dim)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Login</button>
                    <button onClick={() => setMode('register')} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: mode === 'register' ? 'rgba(0,229,255,0.1)' : 'transparent', color: mode === 'register' ? 'var(--cyan-neon)' : 'var(--text-dim)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Sign up</button>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {mode === 'register' && (
                        <>
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required style={{ ...inputStyle }} />
                            </div>
                            <div className="input-group">
                                <label>School / University</label>
                                <input type="text" placeholder="e.g. Harvard Univ" value={school} onChange={e => setSchool(e.target.value)} required style={{ ...inputStyle }} />
                            </div>
                            <div className="input-group">
                                <label>Role</label>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                    <button type="button" onClick={() => setRole('student')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${role === 'student' ? 'var(--cyan-neon)' : 'rgba(255,255,255,0.1)'}`, background: role === 'student' ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)', color: role === 'student' ? 'var(--cyan-neon)' : 'white', cursor: 'pointer', fontSize: '12px' }}>Student 🧊</button>
                                    <button type="button" onClick={() => setRole('teacher')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${role === 'teacher' ? 'var(--cyan-neon)' : 'rgba(255,255,255,0.1)'}`, background: role === 'teacher' ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)', color: role === 'teacher' ? 'var(--cyan-neon)' : 'white', cursor: 'pointer', fontSize: '12px' }}>Teacher 🏫</button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="input-group">
                        <label>Email</label>
                        <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ ...inputStyle }} />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle }} />
                    </div>
                    {mode === 'register' && (
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ ...inputStyle }} />
                        </div>
                    )}

                    {error && (
                        <div style={{ background: 'rgba(255,75,75,0.15)', border: '1px solid rgba(255,75,75,0.4)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#ff6b6b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>{error}
                        </div>
                    )}

                    <button type="submit" className="auth-btn" style={{ marginTop: '4px', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading}>
                        {loading
                            ? <><span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>ac_unit</span> Loading...</>
                            : mode === 'login' ? 'Enter the Avalanche 🏔️' : 'Create Account ❄️'
                        }
                    </button>
                </form>

                <div style={{ marginTop: '16px', fontSize: '10px', color: 'var(--text-dim)', opacity: 0.5, textAlign: 'center' }}>
                    ❄️ Snowball Effect Enabled ❄️
                </div>
            </div>
        </div>
    );
};

// ─── CreatePostView ────────────────────────────────────────────────────────────
const CreatePostView = ({ user, onExit }) => {
    const [mode, setMode] = useState<'choose' | 'text' | 'video'>('choose');

    if (mode === 'video') return <CameraView user={user} onExit={onExit} />;
    if (mode === 'text') return <TextPostView user={user} onExit={onExit} />;

    return (
        <div className="fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '20px', background: 'var(--bg-main)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '52px', color: 'var(--cyan-neon)' }}>add_circle</span>
            <h2 style={{ marginBottom: '4px' }}>Create a Post ❄️</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', marginBottom: '8px' }}>
                Share an English tip with everyone!
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', maxWidth: '340px' }}>
                <div
                    onClick={() => setMode('video')}
                    className="frosted ice-texture"
                    style={{ padding: '28px 16px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0,229,255,0.2)', transition: 'all 0.2s ease' }}
                >
                    <div style={{ fontSize: '44px', marginBottom: '10px' }}>🎬</div>
                    <p style={{ fontWeight: 700, fontSize: '15px' }}>Video</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>Record with camera</p>
                </div>
                <div
                    onClick={() => setMode('text')}
                    className="frosted ice-texture"
                    style={{ padding: '28px 16px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0,229,255,0.2)', transition: 'all 0.2s ease' }}
                >
                    <div style={{ fontSize: '44px', marginBottom: '10px' }}>✍️</div>
                    <p style={{ fontWeight: 700, fontSize: '15px' }}>Text</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>Write a tip or post</p>
                </div>
            </div>

            <button onClick={onExit} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
        </div>
    );
};

// ─── TextPostView ──────────────────────────────────────────────────────────────
const TextPostView = ({ user, onExit }) => {
    const [text, setText] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [posting, setPosting] = useState(false);
    const [charLimit] = useState(280);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState(0);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), snap => {
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((u: any) => u.id !== user?.uid);
            if (!users.some((u: any) => u.name === 'Ava')) {
                users.push({ id: 'ava-ai', name: 'Ava', role: 'teacher', avatar: '❄️' });
            }
            setAllUsers(users);
        });
        return () => unsub();
    }, [user?.uid]);

    const mentionSuggestions = mentionQuery !== null
        ? allUsers.filter((u: any) =>
            (u.name || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 5)
        : [];

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setText(val);
        const pos = e.target.selectionStart ?? val.length;
        const before = val.slice(0, pos);
        const atIdx = before.lastIndexOf('@');
        if (atIdx !== -1 && !before.slice(atIdx).includes(' ')) {
            setMentionQuery(before.slice(atIdx + 1));
            setMentionStart(atIdx);
        } else {
            setMentionQuery(null);
        }
    };

    const insertMention = (u: any) => {
        const firstName = (u.name || u.email || '').split(' ')[0].toLowerCase().replace(/\s/g, '');
        const tag = `@${firstName} `;
        const newText = text.slice(0, mentionStart) + tag + text.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
        setText(newText);
        setMentionQuery(null);
        setTimeout(() => {
            const ta = textareaRef.current;
            if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = mentionStart + tag.length; }
        }, 0);
    };

    const handlePost = async () => {
        if (!text.trim() || posting) return;
        setPosting(true);
        const mentions = [...text.matchAll(/@(\w+)/g)].map(m => m[1]);
        try {
            const docRef = await addDoc(collection(db, 'posts'), {
                type: 'text',
                content: text.trim(),
                topic: selectedTopic,
                mentions,
                authorId: user.uid,
                authorName: user.name || user.email,
                authorAvatar: user.avatar || '🧊',
                authorRole: user.role || 'student',
                authorSchool: user.school || '',
                likes: [],
                commentCount: 0,
                createdAt: serverTimestamp(),
            });

            // Close the screen immediately for better UX
            onExit();

            // Handle notifications in the background
            if (mentions.length > 0) {
                if (mentions.some(m => m.toLowerCase() === 'ava')) {
                    setTimeout(async () => {
                        await addDoc(collection(db, 'notifications'), {
                            recipientUid: user.uid,
                            senderName: 'Ava',
                            senderAvatar: '❄️',
                            type: 'mention',
                            postId: docRef.id,
                            text: "You mentioned me! I love your progress. Keep up the English! ❄️✨",
                            read: false,
                            createdAt: serverTimestamp()
                        }).catch(e => console.error("Ava notification failed:", e));
                    }, 3000);
                }

                mentions.forEach(async (username) => {
                    if (username.toLowerCase() === 'ava') return;
                    const targetUser = allUsers.find(u => {
                        const firstName = (u.name || '').split(' ')[0].toLowerCase();
                        const emailPrefix = (u.email || '').split('@')[0].toLowerCase();
                        return firstName === username.toLowerCase() || emailPrefix === username.toLowerCase();
                    });

                    if (targetUser && targetUser.id !== user.uid) {
                        try {
                            await addDoc(collection(db, 'notifications'), {
                                recipientUid: targetUser.id,
                                senderName: user.name || 'Avalanche User',
                                senderAvatar: user.avatar || '🧊',
                                type: 'mention',
                                postId: docRef.id,
                                text: `has mentioned you in a new post: "${text.trim().substring(0, 30)}..."`,
                                read: false,
                                createdAt: serverTimestamp()
                            });
                        } catch (e) { console.error("Mention notification failed:", e); }
                    }
                });
            }
        } catch (e) {
            console.error("Post creation failed:", e);
            setPosting(false);
            alert("Oops! Failed to post. Check your connection. ❄️");
        }
    };

    const insertEmoji = (em: string) => {
        setText(prev => prev + em);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    const remaining = 280 - text.length;

    return (
        <div className="fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
                <h3 style={{ margin: 0 }}>New Post ✍️</h3>
                <button
                    onClick={handlePost}
                    disabled={!text.trim() || posting || remaining < 0}
                    style={{
                        background: text.trim() && remaining >= 0 ? 'var(--cyan-neon)' : 'rgba(0,229,255,0.2)',
                        border: 'none', borderRadius: '20px', padding: '8px 18px',
                        color: text.trim() ? '#020817' : 'var(--text-dim)',
                        fontWeight: 700, fontSize: '13px', cursor: text.trim() ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    {posting
                        ? <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>ac_unit</span>
                        : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span> Post</>
                    }
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px 8px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid rgba(0,229,255,0.3)' }}>
                    {user.avatar || '🧊'}
                </div>
                <div>
                    <p style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{user.role === 'teacher' ? '🏫 Teacher' : '🧊 Student'} · {user.school}</p>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {mentionSuggestions.length > 0 && (
                    <div className="frosted" style={{ position: 'absolute', bottom: '100%', left: '12px', right: '12px', zIndex: 100, borderRadius: '12px', border: '1px solid rgba(0,229,255,0.25)', overflow: 'hidden', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)' }}>
                        {mentionSuggestions.map((u: any) => (
                            <div key={u.id} onMouseDown={() => insertMention(u)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                                    {u.avatar || '🧊'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.name}</span>
                                    <span style={{ fontSize: '10px', marginLeft: '6px', color: u.role === 'teacher' ? '#FFD700' : 'var(--cyan-neon)' }}>{u.role === 'teacher' ? '🏫 Teacher' : '🧊 Student'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    placeholder={"Share an English tip, phrase, or thought...\n\nTip: type @ to mention someone!"}
                    autoFocus
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '16px', lineHeight: '1.6', padding: '8px 20px', resize: 'none' }}
                />
            </div>

            <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>Topic (optional)</p>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {TOPIC_CHIPS.map(t => (
                        <span key={t} onClick={() => setSelectedTopic(selectedTopic === t ? '' : t)} style={{ whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', background: selectedTopic === t ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.06)', color: selectedTopic === t ? 'var(--cyan-neon)' : 'var(--text-dim)', border: `1px solid ${selectedTopic === t ? 'var(--cyan-neon)' : 'rgba(255,255,255,0.1)'}` }}>{t}</span>
                    ))}
                </div>
            </div>

            <div style={{ padding: '8px 16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {QUICK_EMOJIS.map(em => <span key={em} onClick={() => insertEmoji(em)} style={{ fontSize: '22px', cursor: 'pointer' }}>{em}</span>)}
                </div>
                <span style={{ fontSize: '12px', color: remaining < 0 ? '#ff6b6b' : 'var(--text-dim)' }}>{remaining}</span>
            </div>
        </div>
    );
};

// ─── HomeFeed ──────────────────────────────────────────────────────────────────
const HomeFeed = ({ user, allPosts }) => {
    const [loading, setLoading] = useState(false);
    const [likedPosts, setLikedPosts] = useState<string[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), snap => {
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);
    const [shareToast, setShareToast] = useState(false);

    useEffect(() => {
        // Sync likes for current user
        const liked = allPosts.filter(p => p.likes?.includes(user?.uid)).map(p => p.id);
        setLikedPosts(liked);
    }, [allPosts, user?.uid]);

    useEffect(() => {
        if (!activePostId) return;
        const q = query(collection(db, 'posts', activePostId, 'comments'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [activePostId]);

    const handleLike = async (post: any) => {
        if (!user?.uid) return;
        const postRef = doc(db, 'posts', post.id);
        const isLiked = likedPosts.includes(post.id);
        await updateDoc(postRef, {
            likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });

        // Points for liking/being liked
        if (!isLiked && post.authorId !== user.uid) {
            await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(1) });
            await updateDoc(doc(db, 'users', post.authorId), { snowPoints: increment(1) });
        }
    };

    const handleVerifyPost = async (postId: string, authorId: string) => {
        if (user?.role !== 'teacher') return;
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, { verified: true });
        await updateDoc(doc(db, 'users', authorId), { snowPoints: increment(50) }); // Big bonus for verified explanations
    };

    const handleShare = async (post: any) => {
        const shareData = { title: 'Avalanche', text: `Check this tip by ${post.authorName}! ❄️`, url: window.location.href };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2000);
            }
        } catch (e) { console.error(e); }
    };

    const handleSendComment = async () => {
        const text = commentText.trim();
        if (!text || !user?.uid || !activePostId) return;

        const mentionList = [...text.matchAll(/@(\w+)/g)].map(m => m[1]);

        if (replyingTo !== null) {
            const parentRef = doc(db, 'posts', activePostId, 'comments', replyingTo);
            await updateDoc(parentRef, { replies: arrayUnion({ id: Date.now(), author: (user.name || user.email).split(' ')[0], text }) });
            setReplyingTo(null);
        } else {
            await addDoc(collection(db, 'posts', activePostId, 'comments'), {
                authorId: user.uid,
                author: (user.name || user.email).split(' ')[0],
                text,
                createdAt: serverTimestamp(),
                replies: []
            });
            const postRef = doc(db, 'posts', activePostId);
            const post = allPosts.find(p => p.id === activePostId);
            await updateDoc(postRef, { commentCount: (post?.commentCount || 0) + 1 });

            // Points for commenting using Gemini
            const evaluation = await evaluateComment(text);
            let points = 0;
            if (evaluation.isConstructive) {
                points = evaluation.isEnglish ? 10 : 5;
            }
            if (points > 0) {
                await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(points) });
            }
        }

        // Send notifications for mentions in comment
        for (const username of mentionList) {
            // Robust match: first name or email prefix
            const targetUser = allUsers.find(u => {
                const firstName = (u.name || '').split(' ')[0].toLowerCase();
                const emailPrefix = (u.email || '').split('@')[0].toLowerCase();
                return firstName === username.toLowerCase() || emailPrefix === username.toLowerCase();
            });

            if (targetUser && targetUser.id !== user.uid) {
                await addDoc(collection(db, 'notifications'), {
                    recipientUid: targetUser.id,
                    senderName: user.name || 'Avalanche User',
                    senderAvatar: user.avatar || '🧊',
                    type: 'mention',
                    postId: activePostId,
                    text: `mentioned you in a comment: "${text.substring(0, 30)}..."`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }
        }

        setCommentText('');
    };

    return (
        <div className="discovery-screen" style={{ height: '100%', overflowY: 'hidden', paddingBottom: '0' }}>
            <div className="reels-container">
                {loading ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ animation: 'spin 2s linear infinite', color: 'var(--cyan-neon)', fontSize: '48px' }}>ac_unit</span>
                    </div>
                ) : allPosts.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>history_edu</span>
                        <p style={{ marginTop: '16px' }}>Be the first to create the avalanche!</p>
                    </div>
                ) : (
                    allPosts.map((post: any) => {
                        const isLiked = likedPosts.includes(post.id);
                        const isAva = post.authorName === 'Ava';

                        return (
                            <div key={post.id} className="reel-item">
                                {post.type === 'video' ? (
                                    <video
                                        src={post.videoUrl}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-main)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ maxWidth: '400px' }}>
                                            <p style={{ fontSize: '24px', fontWeight: 300, lineHeight: 1.4, fontStyle: 'italic', marginBottom: '20px' }}>
                                                "{renderTextWithMentions(post.content)}"
                                            </p>
                                            <div style={{ height: '2px', width: '60px', background: 'var(--cyan-neon)', margin: '0 auto', opacity: 0.5 }}></div>
                                        </div>
                                    </div>
                                )}

                                <div className="reel-content-overlay">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                        {post.verified && <span className="points-badge verified-badge"><span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span> VERIFIED</span>}
                                        {post.type === 'video' && <span className="points-badge">+15 SNOW POINTS</span>}
                                        {isAva && <span className="points-badge" style={{ background: '#FFD700', color: '#000' }}>AI MODERATOR</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--cyan-neon)', overflow: 'hidden' }}>
                                            {post.authorPhoto ? <img src={post.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{post.authorAvatar || '🧊'}</div>}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>@{(post.authorName || 'user').split(' ')[0].toLowerCase()}</h3>
                                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{post.authorSchool}</p>
                                        </div>
                                    </div>
                                    {post.type === 'video' && <p style={{ marginTop: '14px', fontSize: '14px', maxWidth: '80%', lineHeight: 1.4, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>Check out this English tip! 🔥 ❄️</p>}
                                </div>

                                <div className="interaction-sidebar">
                                    {user?.role === 'teacher' && !post.verified && (
                                        <div onClick={() => handleVerifyPost(post.id, post.authorId)} className="interaction-btn">
                                            <div className="interaction-icon-wrapper" style={{ borderColor: '#4CAF50', color: '#4CAF50' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>verified</span>
                                            </div>
                                            <span className="label">Verify</span>
                                        </div>
                                    )}

                                    <div onClick={() => handleLike(post)} className="interaction-btn">
                                        <div className="interaction-icon-wrapper" style={{ color: isLiked ? '#ff4b6e' : 'white' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px', fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                                        </div>
                                        <span className="label">{post.likes?.length || 0}</span>
                                    </div>

                                    <div onClick={() => { setActivePostId(post.id); setShowComments(true); }} className="interaction-btn">
                                        <div className="interaction-icon-wrapper">
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>chat_bubble</span>
                                        </div>
                                        <span className="label">{post.commentCount || 0}</span>
                                    </div>

                                    <div onClick={() => handleShare(post)} className="interaction-btn">
                                        <div className="interaction-icon-wrapper">
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>share</span>
                                        </div>
                                        <span className="label">Share</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showComments && activePostId && (
                <div className="frosted fade-in" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '80vh', zIndex: 2000, borderTop: '2px solid var(--cyan-neon)', display: 'flex', flexDirection: 'column', maxWidth: '600px', margin: '0 auto', boxShadow: '0 -20px 60px rgba(0,0,0,0.8)' }}>
                    <div className="comment-zone-header" style={{ position: 'relative' }}>
                        English Zone ❄️
                        <span className="material-symbols-outlined" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }} onClick={() => { setShowComments(false); setActivePostId(null); }}>close</span>
                    </div>

                    <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {comments.length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '60px', opacity: 0.3 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>chat_bubble_outline</span>
                                <p style={{ marginTop: '10px' }}>Be the first to comment!</p>
                            </div>
                        ) : comments.map(c => (
                            <div key={c.id}>
                                <div className="frosted" style={{ padding: '14px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cyan-neon)' }}>{c.author}</p>
                                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => { setReplyingTo(c.id); setTimeout(() => commentInputRef.current?.focus(), 50); }}>Reply</span>
                                    </div>
                                    <p style={{ fontSize: '14px', color: 'white' }}>{renderTextWithMentions(c.text)}</p>
                                </div>
                                {(c.replies || []).map((r: any) => (
                                    <div key={r.id} className="frosted" style={{ padding: '10px', marginTop: '6px', marginLeft: '24px', borderLeft: '2px solid var(--cyan-neon)', borderRadius: '14px', background: 'rgba(255,255,255,0.01)' }}>
                                        <p style={{ fontWeight: 600, fontSize: '12px', color: 'white' }}>{r.author}</p>
                                        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{renderTextWithMentions(r.text)}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '16px 20px 40px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                ref={commentInputRef}
                                type="text"
                                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--cyan-neon)', borderRadius: '24px', padding: '12px 18px', color: 'white', outline: 'none' }}
                            />
                            <button onClick={handleSendComment} style={{ background: 'var(--cyan-neon)', color: '#020817', border: 'none', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shareToast && (
                <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', background: 'var(--cyan-neon)', color: 'var(--bg-main)', padding: '8px 20px', borderRadius: '20px', fontWeight: 700, zIndex: 5000, boxShadow: '0 4px 20px rgba(0,229,255,0.4)' }}>
                    Link copied! 📋
                </div>
            )}
        </div>
    );
};

// ─── Discover/Notifications/Profile Views ──────────────────────────────────────
const DiscoverView = ({ user }) => {
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== user?.uid));
        });
        return () => unsub();
    }, [user?.uid]);

    const filtered = users.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.school || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fade-in" style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
            <h2>Discover ❄️</h2>
            <input type="text" placeholder="Search friends or schools..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--cyan-neon)', borderRadius: '20px', padding: '10px 16px', color: 'white', margin: '16px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>
                {filtered.map(u => (
                    <div key={u.id} className="frosted ice-texture" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', overflow: 'hidden' }}>
                            {u.photo ? <img src={u.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.avatar || '🧊')}
                        </div>
                        <div>
                            <p style={{ fontWeight: 700 }}>{u.name}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{u.role} · {u.school}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const NotificationsView = ({ user }) => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'notifications'), where('recipientUid', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
        const unsub = onSnapshot(q, (snap) => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [user?.uid]);

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <h2 className="text-glacial" style={{ marginBottom: '20px' }}>Alerts ❄️</h2>
            {loading ? <div style={{ textAlign: 'center' }}><span className="material-symbols-outlined animation-spin">ac_unit</span></div> :
                notifications.length === 0 ? <p style={{ textAlign: 'center', opacity: 0.5 }}>Everything is chill here. 🧊</p> :
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {notifications.map(n => (
                            <div key={n.id} className={`frosted ${!n.read ? 'neon-border' : ''}`} style={{ padding: '16px', borderRadius: '16px', opacity: n.read ? 0.7 : 1 }} onClick={async () => await updateDoc(doc(db, 'notifications', n.id), { read: true })}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n.senderAvatar || '👤'}</div>
                                    <div>
                                        <p style={{ fontSize: '14px' }}><strong>{n.senderName}</strong> {n.text}</p>
                                        <p style={{ fontSize: '10px', opacity: 0.5 }}>{n.createdAt?.toDate?.().toLocaleTimeString() || 'Just now'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
            }
        </div>
    );
};

const ProfileView = ({ user, allPosts, onLogout }) => {
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

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height, max = 300;
                if (w > h) { if (w > max) { h *= max / w; w = max; } }
                else { if (h > max) { w *= max / h; h = max; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, w, h);
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                setPhoto(base64);
                localStorage.setItem('av_photo', base64);
                setShowPicker(false);
                if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { photo: base64, avatar: null });
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onLogout} style={{ background: 'rgba(255,75,75,0.1)', border: 'none', color: '#ff6b6b', padding: '6px 12px', borderRadius: '20px' }}>Sign out</button></div>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
                    <div className="neon-border" style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden' }}>
                        {photo ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'var(--glacial-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>{avatar}</div>}
                    </div>
                </div>
                <h2>{user.name}</h2>
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
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '12px', background: 'var(--cyan-neon)', border: 'none', borderRadius: '12px', color: '#020817', fontWeight: 700, marginBottom: '16px' }}>Upload Photo</button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {AVATARS.map(em => (
                            <div key={em} onClick={async () => { setAvatar(em); setPhoto(null); setShowPicker(false); if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { avatar: em, photo: null }); }} style={{ fontSize: '32px', textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>{em}</div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="frosted" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Contributions</p>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--cyan-neon)' }}>{allPosts.filter(p => p.authorId === user.uid).length}</p>
                </div>
                <div className="frosted" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Verified</p>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: '#4CAF50' }}>{allPosts.filter(p => p.authorId === user.uid && p.verified).length}</p>
                </div>
            </div>

            <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}><h3>Interests</h3><span onClick={() => { setEditMode(!editMode); }} style={{ color: 'var(--cyan-neon)', fontSize: '12px', cursor: 'pointer' }}>{editMode ? 'Done' : 'Edit'}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {interests.map(i => <span key={i} style={{ padding: '4px 12px', background: 'rgba(0,229,255,0.1)', borderRadius: '20px', fontSize: '12px', border: '1px solid var(--cyan-neon)' }}>#{i} {editMode && <span onClick={async () => { const next = interests.filter(t => t !== i); setInterests(next); if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { interests: next }); }}>×</span>}</span>)}
                    {editMode && INTEREST_SUGGESTIONS.filter(s => !interests.includes(s)).map(s => <span key={s} onClick={async () => { const next = [...interests, s]; setInterests(next); if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { interests: next }); }} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '12px', opacity: 0.5 }}>+{s}</span>)}
                </div>
            </div>
            <div style={{ height: '100px' }} />
        </div>
    );
};

const CameraView = ({ user, onExit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const [recording, setRecording] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        }).then(s => {
            stream = s;
            if (videoRef.current) videoRef.current.srcObject = s;
        }).catch(err => {
            console.error("Camera error:", err);
            setError("Could not access camera/mic. Please check permissions.");
        });

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [facingMode]);

    const handleRecord = () => {
        if (recording) {
            if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            setRecording(false);
        } else {
            let count = 3;
            setCountdown(count);
            const cd = setInterval(() => {
                count--;
                setCountdown(count);
                if (count <= 0) {
                    clearInterval(cd);
                    setCountdown(null);
                    startRecording();
                }
            }, 1000);
        }
    };

    const handlePostVideo = async () => {
        if (!recordedUrl || uploading) return;
        setUploading(true);
        try {
            const response = await fetch(recordedUrl);
            const blob = await response.blob();
            const filename = `videos/${user?.uid}_${Date.now()}.webm`;
            const storageRef = ref(storage, filename);

            const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'video/webm' });

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Video upload failed:", error);
                    setError("Failed to upload video. ❄️");
                    setUploading(false);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

                    await addDoc(collection(db, 'posts'), {
                        type: 'video',
                        videoUrl: downloadUrl,
                        authorId: user.uid,
                        authorName: user.name || user.email,
                        authorAvatar: user.avatar || '🧊',
                        authorRole: user.role || 'teacher',
                        authorSchool: user.school || '',
                        likes: [],
                        commentCount: 0,
                        createdAt: serverTimestamp(),
                        verified: false
                    });

                    // Reward 15 Snow Points
                    if (user?.uid) {
                        await updateDoc(doc(db, 'users', user.uid), {
                            snowPoints: increment(15)
                        });
                    }

                    onExit();
                }
            );
        } catch (e) {
            console.error("Video upload failed:", e);
            setError("Failed to upload video. ❄️");
            setUploading(false);
        }
    };

    const startRecording = () => {
        try {
            const stream = videoRef.current?.srcObject as MediaStream;
            if (!stream) return;
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setRecordedUrl(URL.createObjectURL(blob));
            };
            recorder.start(100);
            mediaRecorderRef.current = recorder;
            setRecording(true);
            setElapsed(0);
            const start = Date.now();
            timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        } catch (e) {
            setError("Failed to start recording.");
        }
    };

    return (
        <div style={{ height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
            {error ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'white' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ff4b4b' }}>error</span>
                    <p style={{ marginTop: '20px' }}>{error}</p>
                    <button onClick={onExit} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', background: 'var(--cyan-neon)', border: 'none' }}>Go Back</button>
                </div>
            ) : recordedUrl ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <video src={recordedUrl} controls autoPlay loop style={{ flex: 1, objectFit: 'cover' }} />
                    <div style={{ padding: '20px', display: 'flex', gap: '10px', background: '#000' }}>
                        <button onClick={() => setRecordedUrl(null)} disabled={uploading} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', opacity: uploading ? 0.5 : 1 }}>Retake</button>
                        <button onClick={handlePostVideo} disabled={uploading} style={{ flex: 1, padding: '14px', background: 'var(--cyan-neon)', borderRadius: '14px', color: '#020817', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {uploading ? <><span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>ac_unit</span> {`Uploading... ${Math.round(uploadProgress)}%`}</> : 'Post ❄️'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                    <div className="no-select" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }} onClick={onExit}><span className="material-symbols-outlined" style={{ color: 'white', fontSize: '32px', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>close</span></div>
                    {countdown !== null && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px', color: 'var(--cyan-neon)', zIndex: 100, textShadow: '0 0 30px var(--cyan-neon)' }}>{countdown}</div>}
                    <div style={{ position: 'absolute', bottom: '150px', width: '100%', textAlign: 'center', color: 'white', zIndex: 10 }}><h3 style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Record an English tip ❄️</h3></div>
                    <div style={{ position: 'absolute', bottom: '60px', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                        <div onClick={handleRecord} className="no-select interactive-element" style={{ width: '70px', height: '70px', borderRadius: '50%', border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,0,0,0.4)' }}>
                            <div style={{ width: recording ? '25px' : '55px', height: recording ? '25px' : '55px', borderRadius: recording ? '4px' : '50%', background: '#ff4b4b', transition: 'all 0.2s ease' }} />
                        </div>
                    </div>
                    {recording && <div style={{ position: 'absolute', top: '25px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,0,0.8)', padding: '5px 15px', borderRadius: '20px', color: 'white', fontSize: '14px', fontWeight: 700, zIndex: 10 }}>{elapsed}s</div>}
                    <div style={{ position: 'absolute', right: '20px', top: '100px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10 }}>
                        <div className="frosted" style={{ padding: '10px', borderRadius: '50%' }} onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}><span className="material-symbols-outlined" style={{ color: 'white', cursor: 'pointer' }}>flip_camera_ios</span></div>
                    </div>
                </>
            )}
        </div>
    );
};
