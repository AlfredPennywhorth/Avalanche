import React, { useEffect, useRef, useState } from 'react';

interface ReelItemProps {
    post: any;
    isActive: boolean;
    isMuted: boolean;
    onMuteToggle: () => void;
    onLike: (post: any) => void;
    onComment: (post: any) => void;
    onShare: (post: any) => void;
    onReact: (post: any) => void;
    onDelete?: (id: string, authorId: string) => void;
    user: any;
    isLiked: boolean;
    onSpeakAva: (text: string, commentId: string) => void;
    avaSpeaking: string | null;
}

const REACTION_EMOJIS = ['❄️', '🔥', '👀', '🤙', '✅'];

const ReelItem: React.FC<ReelItemProps> = ({
    post,
    isActive,
    isMuted,
    onMuteToggle,
    onLike,
    onComment,
    onShare,
    onReact,
    onDelete,
    user,
    renderTextWithMentions,
    isLiked,
    onSpeakAva,
    avaSpeaking
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const isAva = post.authorName === 'Ava' || post.authorId === 'ava-ai' || post.authorAvatar === '❄️';

    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;

        // If Ava is speaking anywhere, or if this post is not active, stop media
        if (isActive && !avaSpeaking) {
            if (video && post.type === 'video') {
                video.play().catch(e => console.warn("Autoplay blocked:", e));
            }
            if (audio && post.type === 'audio') {
                audio.play().catch(e => console.warn("Audio autoplay blocked:", e));
            }
        } else {
            if (video) video.pause();
            if (audio) audio.pause();
        }
    }, [isActive, post.type, avaSpeaking]);

    // Ensure Ava's avatar is correctly loaded
    const avaAvatarPath = "/ava-avatar.png";

    return (
        <div className="reel-item">
            {post.type === 'video' ? (
                <>
                    <video
                        ref={videoRef}
                        src={post.videoUrl}
                        loop
                        muted={isMuted}
                        playsInline
                        onClick={onMuteToggle}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    
                    {/* Volume Toggle Overlay */}
                    <div 
                        onClick={onMuteToggle}
                        style={{ 
                            position: 'absolute', 
                            top: '20px', 
                            right: '20px', 
                            background: 'rgba(0,0,0,0.5)', 
                            padding: '8px', 
                            borderRadius: '50%', 
                            cursor: 'pointer', 
                            zIndex: 150,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'white' }}>
                            {isMuted ? 'volume_off' : 'volume_up'}
                        </span>
                    </div>
                </>
            ) : post.type === 'audio' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, var(--glacial-deep) 0%, var(--bg-main) 100%)' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', boxShadow: '0 0 40px rgba(0,229,255,0.2)', border: '2px solid rgba(0,229,255,0.3)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '60px', color: 'var(--cyan-neon)', animation: isActive ? 'pulse 2s infinite' : 'none' }}>mic</span>
                    </div>
                    <audio
                        ref={audioRef}
                        src={post.videoUrl}
                        style={{ display: 'none' }}
                    />
                </div>
            ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-main)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '260px', width: '100%' }}>
                        <p style={{ fontSize: '22px', fontWeight: 300, lineHeight: 1.4, fontStyle: 'italic', marginBottom: '20px' }}>
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
                    <div className={`avatar-wrapper ${avaSpeaking === post.id ? 'speaking-glow' : ''}`} style={{ width: '40px', height: '40px', borderRadius: '50%', border: isAva ? '2px solid var(--cyan-neon)' : '2px solid white', overflow: 'hidden', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isAva ? (
                            <img src={avaAvatarPath} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ava" />
                        ) : (
                            post.authorPhoto ? <img src={post.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{post.authorAvatar || '🧊'}</span>
                        )}
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{post.authorName}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{post.authorRole} • {post.authorSchool}</p>
                    </div>
                </div>
                <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.5, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)', opacity: 0.9 }}>
                    {post.type !== 'text' && renderTextWithMentions(post.content || '')}
                </p>
                {post.topic && <span style={{ fontSize: '10px', background: 'rgba(0,229,255,0.2)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--cyan-neon)', color: 'var(--cyan-neon)', fontWeight: 700, textTransform: 'uppercase' }}>{post.topic}</span>}
            </div>

            <div className="interaction-sidebar">
                <div onClick={() => onLike(post)} className={`interaction-btn ${isLiked ? 'liked' : ''}`}>
                    <div className="icon-circle">
                        <span className="material-symbols-outlined" style={{ fontSize: '32px', fontVariationSettings: isLiked ? '"FILL" 1' : 'none' }}>favorite</span>
                    </div>
                    <span className="sidebar-label">{post.likes?.length || 0}</span>
                </div>
                
                <div onClick={() => onComment(post)} className="interaction-btn">
                    <div className="icon-circle">
                        <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>chat_bubble</span>
                    </div>
                    <span className="sidebar-label">{post.commentCount || 0}</span>
                </div>

                <div onClick={() => onShare(post)} className="interaction-btn">
                    <div className="icon-circle">
                        <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>share</span>
                    </div>
                    <span className="sidebar-label">Share</span>
                </div>

                {isAva && (
                    <div onClick={() => onSpeakAva(post.content, post.id)} className={`interaction-btn ${avaSpeaking === post.id ? 'active' : ''}`} style={{ color: 'var(--cyan-neon)' }}>
                        <div className="icon-circle" style={{ borderColor: 'var(--cyan-neon)', background: avaSpeaking === post.id ? 'rgba(0,229,255,0.2)' : 'transparent' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '30px', animation: avaSpeaking === post.id ? 'pulse 1s infinite' : 'none' }}>
                                {avaSpeaking === post.id ? 'volume_up' : 'graphic_eq'}
                            </span>
                        </div>
                        <span className="sidebar-label">Listen</span>
                    </div>
                )}

                <div onClick={() => onReact(post)} className="interaction-btn">
                    <div className="icon-circle">
                        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>add_reaction</span>
                    </div>
                    <span className="sidebar-label">React</span>
                </div>

                {onDelete && (post.authorId === user?.uid || user?.role === 'admin') && (
                    <div onClick={() => onDelete(post.id, post.authorId)} className="interaction-btn delete-btn" style={{ marginTop: '10px' }}>
                        <div className="icon-circle" style={{ borderColor: 'rgba(255, 59, 48, 0.4)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#FF3B30' }}>delete</span>
                        </div>
                        <span className="sidebar-label" style={{ color: '#FF3B30' }}>Delete</span>
                    </div>
                )}
            </div>

            {/* Reaction Counters */}
            {post.reactions && Object.keys(post.reactions).some(k => post.reactions[k]?.length > 0) && (
                <div style={{ position: 'absolute', bottom: '80px', left: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap', zIndex: 10 }}>
                    {REACTION_EMOJIS.filter(e => post.reactions?.[e]?.length > 0).map(emoji => (
                        <span key={emoji} onClick={() => onReact(post)}
                            style={{ background: 'rgba(0,0,0,0.55)', borderRadius: '20px', padding: '3px 10px', fontSize: '14px', cursor: 'pointer', backdropFilter: 'blur(6px)', border: (post.reactions?.[emoji] || []).includes(user?.uid) ? '1px solid var(--cyan-neon)' : '1px solid rgba(255,255,255,0.15)' }}
                        >
                            {emoji} {post.reactions[emoji].length}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReelItem;
