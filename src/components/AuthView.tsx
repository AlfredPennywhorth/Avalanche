import React, { useState } from 'react';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthView: React.FC = () => {
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
                    name, school, role, avatar: '🧊', snowPoints: 0,
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

    const inputStyle: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(0,229,255,0.2)', borderRadius: '12px',
        padding: '12px 14px', color: 'white', fontSize: '14px', outline: 'none'
    };

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
                                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
                            </div>
                            <div className="input-group">
                                <label>School / University</label>
                                <input type="text" placeholder="e.g. Harvard Univ" value={school} onChange={e => setSchool(e.target.value)} required style={inputStyle} />
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
                        <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                    </div>
                    {mode === 'register' && (
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={inputStyle} />
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

export default AuthView;
