import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment 
} from 'firebase/firestore';
import { evaluateComment, generateAvaResponse } from '../services/gemini';

interface CommentDrawerProps {
    postId: string | null;
    user: any;
    isOpen: boolean;
    onClose: () => void;
    avaSpeaking: string | null;
    onSpeakAva: (text: string, commentId: string) => void;
    renderTextWithMentions: (text: string) => any;
}

const CommentDrawer: React.FC<CommentDrawerProps> = ({
    postId,
    user,
    isOpen,
    onClose,
    avaSpeaking,
    onSpeakAva,
    renderTextWithMentions
}) => {
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!postId || !isOpen) {
            setComments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const q = query(
                collection(db, 'posts', postId, 'comments'),
                orderBy('createdAt', 'asc')
            );

            const unsubscribe = onSnapshot(q, (snap) => {
                const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setComments(fetched);
                setLoading(false);
                
                // Scroll to bottom
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            }, (error) => {
                console.error("Error fetching comments:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err) {
            console.error("Failed to setup comments listener:", err);
            setLoading(false);
        }
    }, [postId, isOpen]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !postId || sending) return;

        setSending(true);
        const text = newComment.trim();
        setNewComment('');

        try {
            // 1. Evaluate with Gemini
            const evaluation = await evaluateComment(text);
            
            if (!evaluation.isEnglish || !evaluation.isConstructive) {
                alert(evaluation.reason || "Please keep it constructive and in English! ❄️");
                setSending(false);
                return;
            }

            // 2. Add comment
            await addDoc(collection(db, 'posts', postId, 'comments'), {
                authorId: user.uid,
                authorName: user.name || user.email,
                authorAvatar: user.avatar || '🧊',
                authorPhoto: user.photo || null,
                authorRole: user.role || 'student',
                text,
                createdAt: serverTimestamp(),
                replies: []
            });

            // 3. Update total count
            await updateDoc(doc(db, 'posts', postId), {
                commentCount: increment(1)
            });

            // 4. Reward points
            await updateDoc(doc(db, 'users', user.uid), {
                snowPoints: increment(2)
            });

            // 5. check for Ava mention
            const isMentioningAva = text.toLowerCase().includes('@ava');
            if (isMentioningAva) {
                const response = await generateAvaResponse(text, 'mention');
                if (response) {
                    // Add AI response as another comment
                    await addDoc(collection(db, 'posts', postId, 'comments'), {
                        authorId: 'ava-ai',
                        authorName: 'Ava',
                        authorAvatar: '❄️',
                        authorPhoto: '/ava-avatar.png',
                        authorRole: 'Snow Moderator',
                        text: `@${(user.name || user.email).split(' ')[0]} ${response}`,
                        createdAt: serverTimestamp(),
                        replies: []
                    });
                    await updateDoc(doc(db, 'posts', postId), {
                        commentCount: increment(1)
                    });
                }
            }

        } catch (error) {
            console.error("Comment failed:", error);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={`comments-drawer ${isOpen ? 'active' : ''}`}>
            <div style={{ 
                padding: '20px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--cyan-neon)' }}>chat_bubble</span>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Comments</h3>
                    <span style={{ fontSize: '12px', opacity: 0.5 }}>{comments.length}</span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="comments-list" ref={scrollRef}>
                {comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>ac_unit</span>
                        <p>Be the first to break the ice! ❄️</p>
                    </div>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '50%', 
                                border: c.authorId === 'ava-ai' ? '1px solid var(--cyan-neon)' : 'none',
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: 'var(--glacial-mid)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {c.authorPhoto ? (
                                    <img src={c.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span>{c.authorAvatar || '🧊'}</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px', color: c.authorId === 'ava-ai' ? 'var(--cyan-neon)' : 'white' }}>
                                        {c.authorName}
                                    </span>
                                    {c.authorId === 'ava-ai' && (
                                        <span style={{ fontSize: '9px', background: 'var(--cyan-neon)', color: '#000', padding: '1px 5px', borderRadius: '4px', fontWeight: 900 }}>AI</span>
                                    )}
                                    <span style={{ fontSize: '10px', opacity: 0.4 }}>
                                        {c.createdAt?.toDate?.() ? c.createdAt.toDate().toLocaleTimeString([], { hour: '2' as const, minute: '2-digit' as const }) : '...'}
                                    </span>
                                </div>
                                <p style={{ fontSize: '14px', marginTop: '4px', opacity: 0.9, lineHeight: 1.4 }}>
                                    {renderTextWithMentions(c.text)}
                                </p>
                                
                                {c.authorId === 'ava-ai' && (
                                    <button 
                                        onClick={() => onSpeakAva(c.text, c.id)}
                                        style={{ 
                                            background: 'none', 
                                            border: 'none', 
                                            color: 'var(--cyan-neon)', 
                                            padding: 0, 
                                            marginTop: '8px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '4px', 
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span className={`material-symbols-outlined ${avaSpeaking === c.id ? 'animation-spin' : ''}`} style={{ fontSize: '16px' }}>
                                            {avaSpeaking === c.id ? 'graphic_eq' : 'volume_up'}
                                        </span>
                                        {avaSpeaking === c.id ? 'Ava is speaking...' : 'Listen to Ava'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSend} className="comment-input-area">
                <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    background: 'rgba(255,255,255,0.06)', 
                    borderRadius: '24px', 
                    padding: '8px 16px',
                    border: '1px solid rgba(0,229,255,0.2)'
                }}>
                    <input 
                        type="text" 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Say something nice..."
                        style={{ 
                            flex: 1, 
                            background: 'none', 
                            border: 'none', 
                            color: 'white', 
                            outline: 'none', 
                            fontSize: '14px' 
                        }}
                    />
                    <button 
                        type="submit" 
                        disabled={!newComment.trim() || sending}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: newComment.trim() ? 'var(--cyan-neon)' : 'rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CommentDrawer;
