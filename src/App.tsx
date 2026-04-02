import React, { useState, useEffect } from 'react';
import { db, auth } from './services/firebase';
import {
    collection,
    addDoc,
    query,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    where,
    limit,
    increment,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import { useAuth } from './hooks/useAuth';
import { usePosts } from './hooks/usePosts';
import { supabase } from './services/supabase';
import { evaluateComment, generateAvaResponse } from './services/gemini';

import HomeFeed from './components/HomeFeed';
import CommentDrawer from './components/CommentDrawer';
import AuthView from './components/AuthView';
import LeaderboardView from './components/LeaderboardView';
import NotificationsView from './components/NotificationsView';
import ProfileView from './components/ProfileView';
import CreatePostView from './components/CreatePostView';

// ── Helpers ───────────────────────────────────────────────────────────────────
const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/gi);
    return parts.map((part, i) => {
        if (part.startsWith('@')) {
            const isAva = part.toLowerCase() === '@ava';
            return (
                <span key={i} style={{
                    color: isAva ? 'var(--cyan-neon)' : '#00E5FF',
                    fontWeight: isAva ? 800 : 600,
                    textShadow: isAva ? '0 0 10px rgba(0,229,255,0.5)' : 'none'
                }}>{part}</span>
            );
        }
        return part;
    });
};

type AppView = 'home' | 'create' | 'notifications' | 'profile' | 'leaderboard';

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
    const { user, loading } = useAuth();
    const { posts: allPosts, hasMore, loadingMore, loadMore } = usePosts(user?.uid);

    const [view, setView] = useState<AppView>('home');
    const [unreadCount, setUnreadCount] = useState(0);
    const [likedPosts, setLikedPosts] = useState<string[]>([]);
    const [isMuted, setIsMuted] = useState(true);
    const [avaSpeaking, setAvaSpeaking] = useState<string | null>(null);
    const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
    const [activePostId, setActivePostId] = useState<string | null>(null);

    // Likes sincronizados localmente
    useEffect(() => {
        if (!user?.uid) return;
        const liked = allPosts.filter(p => p.likes?.includes(user.uid)).map(p => p.id);
        setLikedPosts(liked);
    }, [allPosts, user?.uid]);

    // Contador de notificações não lidas
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'notifications'),
            where('recipientUid', '==', user.uid),
            where('read', '==', false)
        );
        const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size), () => {});
        return () => unsub();
    }, [user?.uid]);

    // ── Navigation ────────────────────────────────────────────────────────────
    const resetHome = () => {
        if (view !== 'home') setView('home');
        window.dispatchEvent(new CustomEvent('scroll-to-top'));
        setIsCommentDrawerOpen(false);
        setActivePostId(null);
    };

    const logout = async () => {
        await signOut(auth);
        setView('home');
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleLike = async (post: any) => {
        if (!user?.uid || post.authorId === user.uid) return;
        const postRef = doc(db, 'posts', post.id);
        const isLiked = likedPosts.includes(post.id);
        await updateDoc(postRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
        if (!isLiked) {
            await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(1) });
            await updateDoc(doc(db, 'users', post.authorId), { snowPoints: increment(1) });
        }
    };

    const handleReact = async (post: any, emoji: string) => {
        if (!user?.uid) return;
        const postRef = doc(db, 'posts', post.id);
        const reactions = post.reactions || {};
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(user.uid);
        await updateDoc(postRef, { [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid) });
        if (!hasReacted && post.authorId && post.authorId !== user.uid) {
            await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(1) });
            await updateDoc(doc(db, 'users', post.authorId), { snowPoints: increment(2) });
        }
    };

    const handleShare = async (post: any) => {
        const shareData = { title: 'Avalanche', text: `Check this tip by ${post.authorName}! ❄️`, url: window.location.href };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Link copied! 📋' }));
            }
        } catch (e) { console.error(e); }
    };

    const handleDeletePost = async (postId: string, authorId: string) => {
        const isAdmin = user?.role === 'admin';
        if (authorId !== user?.uid && !isAdmin) { alert("You don't have permission to delete this post. ❄️"); return; }
        if (!window.confirm('Are you sure you want to delete this post? This action is permanent! 🏔️')) return;
        try {
            const post = allPosts.find(p => p.id === postId);
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'posts', postId));
            if (post?.videoUrl) {
                const fileName = post.videoUrl.split('/').pop();
                const bucket = post.type === 'video' ? 'Videos' : 'avatars';
                await supabase.storage.from(bucket).remove([fileName]);
            }
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Post deleted successfully! 🧹' }));
        } catch (e) { console.error('Delete failed:', e); alert('Error deleting post. Please try again.'); }
    };

    const handleOpenComments = (postOrId: string | any) => {
        const id = typeof postOrId === 'string' ? postOrId : postOrId.id;
        setActivePostId(id);
        setIsCommentDrawerOpen(true);
    };

    const handleSpeakAva = (text: string, commentId: string) => {
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = text.replace(/@\w+/g, '').trim();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            const cleanup = () => setAvaSpeaking(null);
            utterance.onstart = () => setAvaSpeaking(commentId);
            utterance.onend = cleanup;
            utterance.onerror = (e) => { console.error('TTS Error:', e); cleanup(); };
            window.speechSynthesis.speak(utterance);
            setTimeout(cleanup, 30000);
        } catch (e) { console.error('TTS failure:', e); setAvaSpeaking(null); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
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

    if (!user) return <AuthView />;

    const renderContent = () => {
        switch (view) {
            case 'create':
                return <CreatePostView user={user} onExit={resetHome} onOpenComments={handleOpenComments} setActivePostId={setActivePostId} setIsCommentDrawerOpen={setIsCommentDrawerOpen} setAvaSpeaking={setAvaSpeaking} />;
            case 'leaderboard':
                return <LeaderboardView user={user} />;
            case 'notifications':
                return <NotificationsView user={user} />;
            case 'profile':
                return <ProfileView user={user} allPosts={allPosts} onLogout={logout} />;
            default:
                return (
                    <HomeFeed
                        user={user}
                        allPosts={allPosts}
                        onLike={handleLike}
                        onComment={handleOpenComments}
                        onShare={handleShare}
                        onReact={(post) => handleReact(post, '❄️')}
                        onDelete={handleDeletePost}
                        likedPosts={likedPosts}
                        isMuted={isMuted}
                        setIsMuted={setIsMuted}
                        renderTextWithMentions={renderTextWithMentions}
                        onSpeakAva={handleSpeakAva}
                        avaSpeaking={avaSpeaking}
                        onFollow={(uid) => console.log('Following user:', uid)}
                        onLoadMore={loadMore}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                    />
                );
        }
    };

    return (
        <div className="discovery-screen">
            <header className="header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', background: 'rgba(2, 8, 23, 0.9)', backdropFilter: 'blur(10px)' }}>
                <h1 className="text-glacial" style={{ fontSize: '20px', letterSpacing: '2px', fontWeight: 900, cursor: 'pointer' }} onClick={resetHome}>AVALANCHE</h1>
            </header>

            <main style={{ flex: 1, marginTop: '60px', position: 'relative', height: 'calc(100dvh - 60px)', overflow: 'hidden' }}>
                {renderContent()}
            </main>

            {view !== 'create' && (
                <nav className="nav-bar">
                    <div className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => { setView('home'); resetHome(); }}>
                        <span className="material-symbols-outlined">home</span>
                    </div>
                    <div className="nav-item" onClick={resetHome}>
                        <span className="material-symbols-outlined">explore</span>
                    </div>
                    <div className="nav-item create-btn" onClick={() => setView('create')}>
                        <span className="material-symbols-outlined">add</span>
                    </div>
                    <div className={`nav-item ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>
                        <span className="material-symbols-outlined">emoji_events</span>
                    </div>
                    <div className={`nav-item ${view === 'notifications' ? 'active' : ''}`} onClick={() => setView('notifications')} style={{ position: 'relative' }}>
                        <span className="material-symbols-outlined">notifications</span>
                        {unreadCount > 0 && (
                            <div style={{ position: 'absolute', top: '8px', right: '14px', width: '10px', height: '10px', background: '#FF3B30', borderRadius: '50%', border: '2px solid var(--bg-main)', boxShadow: '0 0 8px rgba(255,59,48,0.5)' }} />
                        )}
                    </div>
                    <div className={`nav-item ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--glacial-mid), var(--glacial-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: view === 'profile' ? '1px solid var(--cyan-neon)' : 'none', overflow: 'hidden' }}>
                            {user.photo ? <img src={user.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.avatar || '🧊')}
                        </div>
                    </div>
                </nav>
            )}

            <CommentDrawer
                isOpen={isCommentDrawerOpen}
                onClose={() => { setIsCommentDrawerOpen(false); setActivePostId(null); }}
                postId={activePostId}
                user={user}
                avaSpeaking={avaSpeaking}
                onSpeakAva={handleSpeakAva}
                renderTextWithMentions={renderTextWithMentions}
            />
        </div>
    );
}
