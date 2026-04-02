import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReelItem from './ReelItem';

interface HomeFeedProps {
    user: any;
    allPosts: any[];
    onLike: (post: any) => void;
    onComment: (post: any) => void;
    onShare: (post: any) => void;
    onReact: (post: any) => void;
    onDelete?: (id: string, authorId: string) => void;
    likedPosts: string[];
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    onSpeakAva: (text: string, commentId: string) => void;
    avaSpeaking: string | null;
    renderTextWithMentions?: (text: string) => any;
    onFollow?: (targetUid: string) => void;
    // Paginação
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}

const HomeFeed: React.FC<HomeFeedProps> = ({
    user, allPosts, onLike, onComment, onShare, onReact, onDelete,
    likedPosts, isMuted, setIsMuted, renderTextWithMentions,
    onSpeakAva, avaSpeaking, onFollow,
    onLoadMore, hasMore = false, loadingMore = false,
}) => {
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // ── IntersectionObserver para detectar post ativo (com root:null) ──────────
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('data-post-id');
                        if (id) setActivePostId(id);
                    }
                });
            },
            { root: null, rootMargin: '0px', threshold: 0.6 }
        );

        if (containerRef.current) {
            containerRef.current.querySelectorAll('[data-post-id]').forEach(el => {
                observerRef.current?.observe(el);
            });
        }

        return () => observerRef.current?.disconnect();
    }, [allPosts]);

    // ── Sentinel para infinite scroll (carrega mais posts) ───────────────────
    const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
    const loadMoreStable = useCallback(() => {
        if (onLoadMore && hasMore && !loadingMore) onLoadMore();
    }, [onLoadMore, hasMore, loadingMore]);

    useEffect(() => {
        if (sentinelObserverRef.current) sentinelObserverRef.current.disconnect();
        if (!sentinelRef.current) return;

        sentinelObserverRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMoreStable();
            },
            { root: null, rootMargin: '200px', threshold: 0 }
        );

        sentinelObserverRef.current.observe(sentinelRef.current);
        return () => sentinelObserverRef.current?.disconnect();
    }, [loadMoreStable]);

    // ── Scroll-to-top via evento global ──────────────────────────────────────
    useEffect(() => {
        const handleScrollToTop = () => {
            if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            if (allPosts.length > 0) setActivePostId(allPosts[0].id);
        };
        window.addEventListener('scroll-to-top', handleScrollToTop);
        return () => window.removeEventListener('scroll-to-top', handleScrollToTop);
    }, [allPosts]);

    // ── Ativa o primeiro post ao carregar ────────────────────────────────────
    useEffect(() => {
        if (allPosts.length > 0 && !activePostId) setActivePostId(allPosts[0].id);
    }, [allPosts]);

    const registerPostRef = (el: HTMLDivElement | null) => {
        if (el && observerRef.current) observerRef.current.observe(el);
    };

    return (
        <div
            ref={containerRef}
            className="reels-container"
            style={{
                height: '100%',
                overflowY: 'scroll',
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {allPosts.length === 0 ? (
                <div className="empty-feed">
                    <span className="material-symbols-outlined">history_edu</span>
                    <p>Be the first to create the avalanche!</p>
                </div>
            ) : (
                <>
                    {allPosts.map((post: any) => (
                        <div
                            key={post.id}
                            ref={registerPostRef}
                            data-post-id={post.id}
                            style={{
                                height: '100%',
                                minHeight: '100%',
                                scrollSnapAlign: 'start',
                                scrollSnapStop: 'always',
                                position: 'relative',
                                overflow: 'hidden',
                                background: '#000',
                            }}
                        >
                            <ReelItem
                                post={post}
                                user={user}
                                isActive={activePostId === post.id}
                                isMuted={isMuted}
                                onMuteToggle={() => setIsMuted(!isMuted)}
                                onLike={onLike}
                                onComment={onComment}
                                onShare={onShare}
                                onReact={onReact}
                                onDelete={onDelete}
                                renderTextWithMentions={renderTextWithMentions}
                                isLiked={likedPosts.includes(post.id)}
                                onSpeakAva={onSpeakAva}
                                avaSpeaking={avaSpeaking}
                                onFollow={onFollow}
                            />
                        </div>
                    ))}
                    {/* Sentinel de paginação */}
                    <div
                        ref={sentinelRef}
                        style={{ height: '1px', scrollSnapAlign: 'none' }}
                    />
                    {loadingMore && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--cyan-neon)', scrollSnapAlign: 'none' }}>
                            <span className="material-symbols-outlined animation-spin">ac_unit</span>
                        </div>
                    )}
                    {!hasMore && allPosts.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '13px', scrollSnapAlign: 'none' }}>
                            ❄️ You've seen it all!
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HomeFeed;
