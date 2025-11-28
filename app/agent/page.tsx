// app/agent/page.tsx - Fixed SDP filter
"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { rtcConfig } from "@/app/lib/rtcConfig";
import { joinRoom } from "@/app/lib/webrtc";

interface Room {
    id: string;
    offer?: any;
    answer?: any;
    createdAt?: string;
}

export default function AgentPage() {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const persistentRemoteRef = useRef<MediaStream | null>(null);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [joining, setJoining] = useState(false);
    const [status, setStatus] = useState("idle");
    const [needsPlayTap, setNeedsPlayTap] = useState(false);
    const [diag, setDiag] = useState({ localTracks: 0, receivers: 0, ice: "new" });

    // ---------- Rooms listener ----------
    useEffect(() => {
        const roomsRef = collection(firestore, "rooms");
        const unsub = onSnapshot(roomsRef, (snap) => {
            const rs: Room[] = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as any) }))
                .filter((r) => !r.answer)
                .sort((a, b) => {
                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return tb - ta;
                });
            setRooms(rs);
        });
        return () => unsub();
    }, []);

    // ---------- small helpers ----------
    const sleep = (ms = 50) => new Promise((r) => setTimeout(r, ms));

    const attemptPlay = async (video?: HTMLVideoElement | null) => {
        if (!video) return false;
        try {
            video.playsInline = true;
            video.autoplay = true;
            // local preview should be muted so autoplay is allowed
            if (video === localVideoRef.current) video.muted = true;
            // ensure element is visible (some browsers require it)
            video.style.display = (video.style.display || "block");
            await video.play();
            return true;
        } catch (err) {
            console.warn("video.play() blocked or failed:", err);
            setNeedsPlayTap(true);
            return false;
        }
    };

    const handleTapToPlay = async () => {
        setNeedsPlayTap(false);
        await attemptPlay(localVideoRef.current);
        await attemptPlay(remoteVideoRef.current);
    };

    // ---------- cleanup ----------
    useEffect(() => {
        return () => {
            try {
                localStreamRef.current?.getTracks().forEach((t) => t.stop());
            } catch { }
            try {
                pcRef.current?.close();
            } catch { }
            pcRef.current = null;
            localStreamRef.current = null;
            persistentRemoteRef.current = null;
        };
    }, []);

    // ---------- attach local stream safely ----------
    const attachLocalStream = async (stream: MediaStream | null) => {
        const video = localVideoRef.current;
        if (!video || !stream) {
            console.warn("No video element or stream to attach.");
            return;
        }

        // Ensure visibility & size BEFORE attaching (desktop needs this)
        video.style.display = "block";
        video.style.width = video.style.width || "320px";
        video.style.height = video.style.height || "180px";
        video.style.opacity = "1";
        video.style.visibility = "visible";

        // Autoplay-friendly attributes MUST be set before srcObject
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("muted", "true");
        video.setAttribute("playsinline", "true");
        video.setAttribute("autoplay", "true");

        // Attach stream
        video.srcObject = stream;

        // Some browsers benefit from load()
        try { video.load(); } catch { }

        // Try to play; if blocked, show tap overlay
        video.onloadedmetadata = async () => {
            try {
                await video.play();
                console.log("Local video playback started.");
            } catch (err) {
                console.warn("Local video play blocked:", err);
                setNeedsPlayTap(true);
            }
        };

        setDiag((prev) => ({ ...prev, localTracks: stream.getTracks().length }));
    };

    // ---------- attach remote stream ----------
    const attachRemoteStream = async (pc: RTCPeerConnection, event?: RTCTrackEvent) => {
        const el = remoteVideoRef.current;
        if (!el) return;

        // Prefer event.streams[0] (Safari) otherwise add tracks to persistent stream
        if (event && event.streams && event.streams.length > 0) {
            el.srcObject = event.streams[0];
            el.onloadedmetadata = () => attemptPlay(el).catch(() => { });
        } else {
            if (!persistentRemoteRef.current) persistentRemoteRef.current = new MediaStream();
            if (event && event.track) {
                if (!persistentRemoteRef.current.getTracks().some((t) => t.id === event.track.id)) {
                    persistentRemoteRef.current.addTrack(event.track);
                }
            }
            el.srcObject = persistentRemoteRef.current;
            el.onloadedmetadata = () => attemptPlay(el).catch(() => { });
        }

        // update receivers diag
        try {
            setDiag((d) => ({ ...d, receivers: pc.getReceivers().length }));
        } catch { }
    };

    // ---------- main join flow ----------
    const handleJoinRoom = async (roomId: string) => {
        if (joining || connected) return;
        setJoining(true);
        setSelectedRoom(roomId);
        setStatus("Starting camera...");

        try {
            // Ensure DOM has rendered the hidden video (react refs ready)
            await sleep(50);

            // 1) get local media (simple constraints)
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: true,
            }).catch((e) => {
                throw e;
            });

            localStreamRef.current = localStream;
            console.log("GOT LOCAL STREAM:", localStream.getTracks().map(t => `${t.kind}:${t.id}`));

            // attach local preview (ensures attributes set before srcObject)
            await attachLocalStream(localStream);

            setStatus("Creating PeerConnection...");
            const pc = new RTCPeerConnection(rtcConfig);
            pcRef.current = pc;

            // add local tracks BEFORE signaling
            localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

            // prepare persistent remote stream placeholder
            if (!persistentRemoteRef.current) persistentRemoteRef.current = new MediaStream();
            if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                remoteVideoRef.current.srcObject = persistentRemoteRef.current;
            }

            // ontrack handler
            pc.ontrack = async (event) => {
                console.log("ontrack:", event.track.kind, event.track.id, "streams:", event.streams?.length);
                await attachRemoteStream(pc, event);
            };

            // connection state monitoring
            pc.onconnectionstatechange = () => {
                console.log("pc.connectionState:", pc.connectionState);
                setStatus(`Connection: ${pc.connectionState}`);
                setDiag((d) => ({ ...d, ice: pc.iceConnectionState }));
                if (pc.connectionState === "connected") {
                    setConnected(true);
                    setJoining(false);
                    setStatus("Connected!");
                    attemptPlay(remoteVideoRef.current).catch(() => { });
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log("ICE state:", pc.iceConnectionState);
                setStatus(`ICE: ${pc.iceConnectionState}`);
                setDiag((d) => ({ ...d, ice: pc.iceConnectionState }));
            };

            setStatus("Joining room (signaling)...");

            // FIXED: Don't pass sdpFilter - let it use default codecs
            // The aggressive filtering was breaking SDP parsing
            await joinRoom(roomId, pc);

            setStatus("Waiting for remote media...");
            setJoining(false);

            // try play once in case tracks already attached
            attemptPlay(remoteVideoRef.current).catch(() => { });
        } catch (err) {
            console.error("Failed to join room:", err);
            setStatus("Error: " + (err instanceof Error ? err.message : String(err)));
            setJoining(false);
            setSelectedRoom(null);
            alert("Failed to join room: " + (err instanceof Error ? err.message : "Unknown error"));
        }
    };

    const handleHangup = () => {
        try {
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        try {
            pcRef.current?.close();
        } catch { }
        pcRef.current = null;
        localStreamRef.current = null;
        persistentRemoteRef.current = null;
        setConnected(false);
        setSelectedRoom(null);
        setJoining(false);
        setStatus("idle");
    };

    // ---------- UI ----------
    return (
        <div>
            {/* Hidden local video element so ref is available immediately */}
            <video
                ref={localVideoRef}
                muted
                playsInline
                autoPlay
                style={{ width: 0, height: 0, opacity: 0, position: "absolute", pointerEvents: "none" }}
            />

            {/* Connected view */}
            {connected && selectedRoom ? (
                <div className="w-full h-screen bg-gray-900 text-white relative">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ transform: "scaleX(-1)", display: "block" }}
                        className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800"
                    />

                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{ display: "block" }}
                        className="w-full h-full object-cover bg-gray-800"
                    />

                    {needsPlayTap && (
                        <div
                            onClick={handleTapToPlay}
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(0,0,0,0.45)",
                                zIndex: 40,
                                cursor: "pointer",
                                color: "white",
                                fontWeight: 700,
                            }}
                        >
                            ▶ Tap to enable video
                        </div>
                    )}

                    <button
                        onClick={handleHangup}
                        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-semibold transition-colors shadow-lg z-20"
                    >
                        📞 End Call
                    </button>

                    <div className="absolute top-4 left-4 bg-black/80 p-4 rounded-lg z-20">
                        <div className="text-sm text-gray-300">Room: {selectedRoom?.slice(0, 8)}...</div>
                        <div className="text-green-500 font-semibold">● Connected</div>
                    </div>

                    <div style={{ position: "absolute", top: 4, right: 4, zIndex: 50, color: "#ddd", fontSize: 12 }}>
                        <div>Local tracks: {diag.localTracks}</div>
                        <div>Receivers: {diag.receivers}</div>
                        <div>ICE: {diag.ice}</div>
                    </div>
                </div>
            ) : (
                // Waiting dashboard
                <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent Dashboard</h1>
                        <p className="text-gray-600 mb-8">
                            {rooms.length > 0 ? `${rooms.length} waiting customer${rooms.length === 1 ? "" : "s"}` : "No customers waiting"}
                        </p>

                        {joining && (
                            <div className="mb-8 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3" />
                                    <span>{status}</span>
                                </div>
                            </div>
                        )}

                        {rooms.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md p-12 text-center">
                                <div className="text-6xl mb-4">💤</div>
                                <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Active Calls</h2>
                                <p className="text-gray-500">Waiting for customers to initiate calls...</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {rooms.map((room) => (
                                    <div key={room.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                                    <h3 className="text-lg font-semibold text-gray-900">Customer Waiting</h3>
                                                </div>
                                                <p className="text-sm text-gray-500 font-mono">Room: {room.id.slice(0, 12)}...</p>
                                                <p className="text-xs text-gray-400 mt-1">Created: {room.createdAt ? new Date(room.createdAt).toLocaleTimeString() : "Just now"}</p>
                                            </div>
                                            <button
                                                onClick={() => handleJoinRoom(room.id)}
                                                disabled={joining}
                                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                            >
                                                {joining && selectedRoom === room.id ? "Joining..." : "Join Call"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {needsPlayTap && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
                                <button onClick={handleTapToPlay} className="bg-black/80 text-white px-6 py-3 rounded-lg text-lg">▶ Tap to enable video</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}