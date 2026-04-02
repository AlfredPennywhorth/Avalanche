import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/firebase';
import { supabase } from '../services/supabase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { generateAvaResponse } from '../services/gemini';

interface CameraViewProps {
    user: any;
    onExit: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ user, onExit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const mimeTypeUsed = useRef<string>('video/webm');

    const [recording, setRecording] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [caption, setCaption] = useState('');
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'video' | 'audio'>('video');

    useEffect(() => {
        let stream: MediaStream | null = null;
        navigator.mediaDevices.getUserMedia(
            mode === 'video'
                ? { video: { facingMode, aspectRatio: { ideal: 0.5625 }, width: { ideal: 720 } }, audio: true }
                : { audio: true }
        ).then(s => {
            stream = s;
            if (videoRef.current) videoRef.current.srcObject = s;
        }).catch(err => {
            console.error('Camera error:', err);
            setError('Could not access camera/mic. Please check permissions.');
        });

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [facingMode, mode]);

    const startRecording = () => {
        try {
            const stream = videoRef.current?.srcObject as MediaStream;
            if (!stream && mode === 'video') return;
            let mimeType = mode === 'audio' ? 'audio/webm' : 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = mode === 'audio' ? 'audio/mp4' : 'video/mp4';
            }
            const options: MediaRecorderOptions = { mimeType };
            if (mode === 'video') options.videoBitsPerSecond = 1000000;
            mimeTypeUsed.current = mimeType;
            const recorder = new MediaRecorder(stream || (new AudioContext().createMediaStreamDestination().stream), options);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setRecordedUrl(URL.createObjectURL(blob));
            };
            recorder.start(100);
            setRecording(true);
            setElapsed(0);
            const start = Date.now();
            timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        } catch (e) {
            console.error('Recording start error:', e);
            setError('Failed to start recording.');
        }
    };

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
                if (count <= 0) { clearInterval(cd); setCountdown(null); startRecording(); }
                else setCountdown(count);
            }, 1000);
        }
    };

    const handlePostVideo = async () => {
        if (!recordedUrl || uploading) return;
        try {
            if (!chunksRef.current || chunksRef.current.length === 0) throw new Error('Gravação vazia (0 bytes). Grave novamente.');
            const mimeType = mimeTypeUsed.current || (mode === 'audio' ? 'audio/webm' : 'video/webm');
            const finalBlob = new Blob(chunksRef.current, { type: mimeType });
            const MAX_SIZE = 50 * 1024 * 1024;
            if (finalBlob.size > MAX_SIZE) {
                alert(`File too large (${(finalBlob.size / (1024 * 1024)).toFixed(1)}MB). Max limit is 50MB. ❄️`);
                return;
            }
            setUploading(true);
            const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('audio') ? 'm4a' : 'webm';
            const fileName = `${user?.uid}_${Date.now()}.${extension}`;
            setUploadProgress(25);
            const { error: uploadError } = await supabase.storage.from('Videos').upload(fileName, finalBlob, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error(`Upload Error: ${(uploadError as any).message || JSON.stringify(uploadError)}`);
            setUploadProgress(70);
            const { data: { publicUrl } } = supabase.storage.from('Videos').getPublicUrl(fileName);
            const docRef = await addDoc(collection(db, 'posts'), {
                type: mode, content: caption.trim() || (mode === 'video' ? 'Check out this video! ❄️' : 'Listen to this tip! 🎙️'),
                videoUrl: publicUrl, authorId: user.uid, authorName: user.name || user.email,
                authorAvatar: user.avatar || '🧊', authorRole: user.role || 'teacher',
                authorSchool: user.school || '', likes: [], commentCount: 0,
                createdAt: serverTimestamp(), verified: false
            });
            if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { snowPoints: increment(10) });
            const response = await generateAvaResponse(caption || 'Check this out!', 'post');
            if (response) {
                await addDoc(collection(db, 'posts', docRef.id, 'comments'), {
                    authorId: 'ava-ai', authorName: 'Ava', authorAvatar: '❄️',
                    authorPhoto: '/ava-avatar.png', authorRole: 'Snow Moderator',
                    text: `@${(user.name || user.email).split(' ')[0]} ${response}`,
                    createdAt: serverTimestamp(), replies: []
                });
                await updateDoc(doc(db, 'posts', docRef.id), { commentCount: increment(1) });
            }
            setUploading(false);
            setRecordedUrl(null);
            onExit();
        } catch (e: any) {
            const errMsg = e.message || JSON.stringify(e);
            if (errMsg.includes('Failed to fetch')) {
                setError('O Supabase bloqueou o upload por CORS. Verifique no dashboard se o domínio está permitido no Storage. ❄️');
            } else if (errMsg.includes('Timeout')) {
                setError('Falha de rede ou timeout. Verifique sua conexão. ❄️');
            } else {
                setError(`Erro no upload: ${errMsg}`);
            }
            setUploading(false);
        }
    };

    return (
        <div style={{ height: '100dvh', width: '100vw', background: '#000', position: 'fixed', top: 0, left: 0, zIndex: 9999, overflow: 'hidden' }}>
            {error ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'white' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ff4b4b' }}>error</span>
                    <p style={{ marginTop: '20px' }}>{error}</p>
                    <button onClick={onExit} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', background: 'var(--cyan-neon)', border: 'none', cursor: 'pointer' }}>Go Back</button>
                </div>
            ) : recordedUrl ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {mode === 'video'
                            ? <video src={recordedUrl} autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ padding: '40px', textAlign: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '100px', color: 'var(--cyan-neon)' }}>audio_file</span>
                                <p style={{ marginTop: '20px', color: 'var(--cyan-neon)' }}>Audio recorded successfully! 🎙️</p>
                            </div>
                        }
                        {!uploading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px 20px 100px' }}>
                                <div className="frosted neon-border" style={{ padding: '16px', borderRadius: '24px', background: 'rgba(2, 8, 23, 0.7)', backdropFilter: 'blur(20px)' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cyan-neon)', marginBottom: '8px', letterSpacing: '1px' }}>LEGENDA / MENÇÃO</p>
                                    <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Diga algo ou mencione a @ava... ❄️"
                                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '16px', outline: 'none', resize: 'none', minHeight: '80px', fontFamily: 'inherit' }} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ padding: '20px 20px 40px', display: 'flex', gap: '12px', background: 'rgba(2, 8, 23, 0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button onClick={() => { setRecordedUrl(null); setCaption(''); }} disabled={uploading} style={{ flex: 1, padding: '16px', borderRadius: '18px', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
                        <button onClick={handlePostVideo} disabled={uploading} style={{ flex: 2, padding: '16px', background: 'var(--cyan-neon)', borderRadius: '18px', color: '#020817', fontWeight: 800, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 20px rgba(0,229,255,0.4)', cursor: 'pointer' }}>
                            {uploading && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${uploadProgress}%`, background: 'rgba(255,255,255,0.3)', transition: 'width 0.2s ease' }} />}
                            {uploading ? <><span className="material-symbols-outlined animation-spin">ac_unit</span> {Math.round(uploadProgress)}%</> : <><span className="material-symbols-outlined">send</span> Postar na Avalanche</>}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {mode === 'video'
                        ? <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, var(--glacial-deep) 0%, #000 100%)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '100px', color: 'var(--cyan-neon)', animation: recording ? 'pulse 1.5s infinite' : 'none' }}>mic</span>
                        </div>
                    }
                    <div className="no-select" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }} onClick={onExit}>
                        <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '32px', textShadow: '0 0 10px rgba(0,0,0,0.5)', cursor: 'pointer' }}>close</span>
                    </div>
                    {countdown !== null && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px', color: 'var(--cyan-neon)', zIndex: 100, textShadow: '0 0 30px var(--cyan-neon)' }}>{countdown}</div>}
                    <div style={{ position: 'absolute', bottom: '150px', width: '100%', textAlign: 'center', color: 'white', zIndex: 10 }}>
                        <h3 style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{mode === 'audio' ? 'Record an Audio tip 🎙️' : 'Record a Video tip ❄️'}</h3>
                    </div>
                    <div style={{ position: 'absolute', bottom: '60px', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                        <div onClick={handleRecord} className="no-select interactive-element" style={{ width: '70px', height: '70px', borderRadius: '50%', border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,0,0,0.4)' }}>
                            <div style={{ width: recording ? '25px' : '55px', height: recording ? '25px' : '55px', borderRadius: recording ? '4px' : '50%', background: '#ff4b4b', transition: 'all 0.2s ease' }} />
                        </div>
                    </div>
                    {recording && <div style={{ position: 'absolute', top: '25px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,0,0.8)', padding: '5px 15px', borderRadius: '20px', color: 'white', fontSize: '14px', fontWeight: 700, zIndex: 10 }}>{elapsed}s</div>}
                    <div style={{ position: 'absolute', right: '20px', top: '100px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10 }}>
                        {mode === 'video' && (
                            <div className="frosted" style={{ padding: '10px', borderRadius: '50%', cursor: 'pointer' }} onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}>
                                <span className="material-symbols-outlined" style={{ color: 'white' }}>flip_camera_ios</span>
                            </div>
                        )}
                        {!recording && (
                            <div className="frosted" style={{ padding: '10px', borderRadius: '50%', cursor: 'pointer' }} onClick={() => setMode(mode === 'video' ? 'audio' : 'video')}>
                                <span className="material-symbols-outlined" style={{ color: 'white' }}>{mode === 'video' ? 'mic' : 'videocam'}</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CameraView;
