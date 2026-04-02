import React, { useState, useEffect, useRef } from 'react';
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
    renderTextWithMentions: (text: string) => any;
    avaSpeaking: string | null;
}

const HomeFeed: React.FC<HomeFeedProps> = ({
    user,
    allPosts,
    onLike,
    onComment,
    onShare,
    onReact,
    onDelete,
    likedPosts,
    isMuted,
    setIsMuted,
    renderTextWithMentions,
    avaSpeaking
}) => {
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const options = {
            root: containerRef.current,
            rootMargin: '0px',
            threshold: 0.7 // Trigger when 70% of the post is visible
        };

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('data-post-id');
                    setActivePostId(id);
                }
            });
        }, options);

        return () => observerRef.current?.disconnect();
    }, [allPosts]);

    useEffect(() => {
        const handleScrollToTop = () => {
            if (containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                if (allPosts.length > 0) {
                    setActivePostId(allPosts[0].id);
                }
            }
        };

        window.addEventListener('scroll-to-top', handleScrollToTop);
        return () => window.removeEventListener('scroll-to-top', handleScrollToTop);
    }, [allPosts]);

    // Initial play if allPosts is set but observer hasn't triggered
    useEffect(() => {
        if (allPosts.length > 0 && !activePostId) {
            setActivePostId(allPosts[0].id);
        }
    }, [allPosts, activePostId]);

    const registerPostRef = (el: HTMLDivElement | null) => {
        if (el && observerRef.current) {
            observerRef.current.observe(el);
        }
    };

    return (
        <div className="discovery-screen" style={{ height: '100%', overflowY: 'hidden', paddingBottom: '0' }}>
            <div className="reels-container" ref={containerRef} style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory' }}>
                {allPosts.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>history_edu</span>
                        <p style={{ marginTop: '16px' }}>Be the first to create the avalanche!</p>
                    </div>
                ) : (
                    allPosts.map((post: any) => (
                        <div 
                            key={post.id} 
                            ref={registerPostRef} 
                            data-post-id={post.id}
                            style={{ height: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
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
                                avaSpeaking={avaSpeaking}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HomeFeed;
