import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/firebase';
import { supabase } from '../services/supabase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { generateAvaResponse } from '../services/gemini';
import CameraView from './CameraView';

const TOPIC_CHIPS = ['Slang 🤙', 'Phrasal Verbs 🔄', 'Grammar 📖', 'Pronunciation 🗣️', 'Memes 😂', 'Idioms 💡', 'Vocabulary 📚'];
const QUICK_EMOJIS = ['❄️', '🧊', '🏔️', '✅', '💡', '🤙', '🔥', '👀', '💬', '⚡'];

// ── TextPostView ──────────────────────────────────────────────────────────────
interface TextPostViewProps {
    user: any;
    onExit: () => void;
    onOpenComments: (postOrId: any) => void;
    setActivePostId: (id: string) => void;
    setIsCommentDrawerOpen: (open: boolean) => void;
    setAvaSpeaking: (id: string | null) => void;
}

const TextPostView: React.FC<TextPostViewProps> = ({ user, onExit }) => {
    const [text, setText] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [posting, setPosting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState(0);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), snap => {
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((u: any) => u.id !== user?.uid);
            if (!users.some((u: any) => u.name === 'Ava')) {
                users.push({ id: 'ava-ai', name: 'Ava', role: 'teacher', photo: '/ava-avatar.png' });
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
        const textBeforeCursor = val.slice(0, pos);
        const lastAtIndices = [...textBeforeCursor.matchAll(/@/g)];
        const lastAt = lastAtIndices.length > 0 ? lastAtIndices[lastAtIndices.length - 1].index : -1;
        if (lastAt !== undefined && lastAt !== -1) {
            const query = textBeforeCursor.slice(lastAt + 1);
            if (!query.includes(' ') && !query.includes('\n')) {
                setMentionQuery(query);
                setMentionStart(lastAt);
                return;
            }
        }
        setMentionQuery(null);
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
                type: 'text', content: text.trim(), topic: selectedTopic, mentions,
                authorId: user.uid, authorName: user.name || user.email,
                authorAvatar: user.avatar || '🧊', authorPhoto: user.photo || null,
                authorRole: user.role || 'student', authorSchool: user.school || '',
                likes: [], commentCount: 0, createdAt: serverTimestamp(),
            });
            onExit();

            if (mentions.length > 0) {
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
                                recipientUid: targetUser.id, senderName: user.name || 'Avalanche User',
                                senderAvatar: user.avatar || '🧊', senderPhoto: user.photo || null,
                                type: 'mention', postId: docRef.id,
                                text: `has mentioned you in a new post: "${text.trim().substring(0, 30)}..."`,
                                read: false, createdAt: serverTimestamp()
                            });
                        } catch (e) { console.error('Mention notification failed:', e); }
                    }
                });
            }

            setTimeout(async () => {
                const isMentioningAva = mentions.some((m: string) => m.toLowerCase() === 'ava');
                const avaResponse = await generateAvaResponse(text.trim(), isMentioningAva ? 'mention' : 'post');
                if (avaResponse) {
                    await addDoc(collection(db, 'posts', docRef.id, 'comments'), {
                        authorId: 'ava-ai', authorName: 'Ava', authorAvatar: '❄️',
                        authorPhoto: '/ava-avatar.png', authorRole: 'Snow Moderator',
                        text: isMentioningAva ? `@${(user.name || user.email).split(' ')[0]} ${avaResponse}` : avaResponse,
                        createdAt: serverTimestamp(), replies: []
                    });
                    await updateDoc(doc(db, 'posts', docRef.id), { commentCount: increment(1) });
                    await addDoc(collection(db, 'notifications'), {
                        recipientUid: user.uid, senderName: 'Ava', senderAvatar: '❄️',
                        senderPhoto: '/ava-avatar.png', type: isMentioningAva ? 'mention' : 'comment',
                        postId: docRef.id, text: isMentioningAva ? 'replied to your mention! ❄️' : 'commented on your post! ❄️',
                        read: false, createdAt: serverTimestamp()
                    });
                }
            }, 1500);
        } catch (e) {
            console.error('Post creation failed:', e);
            setPosting(false);
            alert('Oops! Failed to post. Check your connection. ❄️');
        }
    };

    const remaining = 280 - text.length;

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={onExit} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
                <h3 style={{ margin: 0 }}>New Post ✍️</h3>
                <button onClick={handlePost} disabled={!text.trim() || posting || remaining < 0}
                    style={{ background: text.trim() && remaining >= 0 ? 'var(--cyan-neon)' : 'rgba(0,229,255,0.2)', border: 'none', borderRadius: '20px', padding: '8px 18px', color: text.trim() ? '#020817' : 'var(--text-dim)', fontWeight: 700, fontSize: '13px', cursor: text.trim() ? 'pointer' : 'default', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {posting ? <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>ac_unit</span> : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span> Post</>}
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px 8px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid rgba(0,229,255,0.3)', overflow: 'hidden' }}>
                    {user.photo ? <img src={user.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.avatar || '🧊')}
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
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, overflow: 'hidden' }}>
                                    {u.photo ? <img src={u.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.avatar || '🧊')}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.name}</span>
                                    <span style={{ fontSize: '10px', marginLeft: '6px', color: u.role === 'teacher' ? '#FFD700' : 'var(--cyan-neon)' }}>{u.role === 'teacher' ? '🏫 Teacher' : '🧊 Student'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <textarea ref={textareaRef} value={text} onChange={handleTextChange}
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
                    {QUICK_EMOJIS.map(em => <span key={em} onClick={() => { setText(prev => prev + em); setMentionQuery(null); textareaRef.current?.focus(); }} style={{ fontSize: '22px', cursor: 'pointer' }}>{em}</span>)}
                </div>
                <span style={{ fontSize: '12px', color: remaining < 0 ? '#ff6b6b' : 'var(--text-dim)' }}>{remaining}</span>
            </div>
        </div>
    );
};

// ── CreatePostView ─────────────────────────────────────────────────────────────
interface CreatePostViewProps {
    user: any;
    onExit: () => void;
    onOpenComments: (postOrId: any) => void;
    setActivePostId: (id: string) => void;
    setIsCommentDrawerOpen: (open: boolean) => void;
    setAvaSpeaking: (id: string | null) => void;
}

const CreatePostView: React.FC<CreatePostViewProps> = ({ user, onExit, onOpenComments, setActivePostId, setIsCommentDrawerOpen, setAvaSpeaking }) => {
    const [mode, setMode] = useState<'choose' | 'text' | 'video'>('choose');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleDirectFileUpload = async (file: File) => {
        if (uploading) return;
        setUploading(true);
        setProgress(10);
        try {
            const ext = file.name.split('.').pop() || 'mp4';
            const fileName = `${user?.uid}_${Date.now()}.${ext}`;
            const isVideo = file.type.startsWith('video');
            setProgress(30);
            const { error: uploadError } = await supabase.storage.from('Videos').upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            setProgress(70);
            const { data: { publicUrl } } = supabase.storage.from('Videos').getPublicUrl(fileName);
            const docRef = await addDoc(collection(db, 'posts'), {
                type: isVideo ? 'video' : 'image', videoUrl: publicUrl,
                content: isVideo ? 'Check out this video! ❄️' : 'Look at this! 📸',
                authorId: user.uid, authorName: user.name || user.email,
                authorAvatar: user.avatar || '🧊', authorRole: user.role || 'student',
                authorSchool: user.school || '', likes: [], commentCount: 0,
                createdAt: serverTimestamp(), verified: false
            });
            if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(isVideo ? 15 : 5) });
            setTimeout(async () => {
                const response = await generateAvaResponse(isVideo ? 'video post' : 'image post', 'post');
                if (response) {
                    await addDoc(collection(db, 'posts', docRef.id, 'comments'), {
                        authorId: 'ava-ai', authorName: 'Ava', authorAvatar: '❄️',
                        authorPhoto: '/ava-avatar.png', authorRole: 'Snow Moderator',
                        text: response, createdAt: serverTimestamp(), replies: []
                    });
                    await updateDoc(doc(db, 'posts', docRef.id), { commentCount: increment(1) });
                }
            }, 1500);
            setProgress(100);
            setTimeout(onExit, 500);
        } catch (e) {
            console.error('Upload failed:', e);
            alert('Upload failed. Please try again.');
            setUploading(false);
        }
    };

    if (uploading) {
        return (
            <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'var(--bg-main)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--cyan-neon)', animation: 'spin 2s linear infinite' }}>ac_unit</span>
                <h3 style={{ marginTop: '20px' }}>Uploading your tip... {progress}%</h3>
                <div style={{ width: '100%', maxWidth: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--cyan-neon)', transition: 'width 0.3s ease' }} />
                </div>
            </div>
        );
    }

    if (mode === 'video') return <CameraView user={user} onExit={onExit} />;
    if (mode === 'text') return <TextPostView user={user} onExit={onExit} onOpenComments={onOpenComments} setActivePostId={setActivePostId} setIsCommentDrawerOpen={setIsCommentDrawerOpen} setAvaSpeaking={setAvaSpeaking} />;

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '20px', background: 'var(--bg-main)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '52px', color: 'var(--cyan-neon)' }}>add_circle</span>
            <h2 style={{ marginBottom: '4px' }}>Create a Post ❄️</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', marginBottom: '8px' }}>Share an English tip with everyone!</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', width: '100%', maxWidth: '400px' }}>
                <div onClick={() => setMode('video')} className="frosted ice-texture" style={{ padding: '20px 10px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0,229,255,0.2)', transition: 'all 0.2s ease' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎬</div>
                    <p style={{ fontWeight: 700, fontSize: '14px' }}>Camera</p>
                </div>
                <div onClick={() => document.getElementById('file-upload-input')?.click()} className="frosted ice-texture" style={{ padding: '20px 10px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0,229,255,0.2)', transition: 'all 0.2s ease' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                    <p style={{ fontWeight: 700, fontSize: '14px' }}>Upload</p>
                    <input id="file-upload-input" type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDirectFileUpload(file); }} />
                </div>
                <div onClick={() => setMode('text')} className="frosted ice-texture" style={{ padding: '20px 10px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0,229,255,0.2)', transition: 'all 0.2s ease' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>✍️</div>
                    <p style={{ fontWeight: 700, fontSize: '14px' }}>Text</p>
                </div>
            </div>
            <button onClick={onExit} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
        </div>
    );
};

export default CreatePostView;
