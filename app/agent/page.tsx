"use client";

import { useEffect, useRef, useState } from "react";
import { rtcConfig } from "@/app/lib/rtcConfig";
import { joinRoom } from "@/app/lib/webrtc";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

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

    // Listen for available rooms
    useEffect(() => {
        const roomsRef = collection(firestore, "rooms");
        const unsub = onSnapshot(roomsRef, (snap) => {
            const rs: Room[] = snap.docs
                .map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        offer: data.offer,
                        answer: data.answer,
                        createdAt: data.createdAt,
                    } as Room;
                })
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

    // small utility to try play and set needsPlayTap if blocked
    const attemptPlay = async (video?: HTMLVideoElement | null) => {
        if (!video) return false;
        video.playsInline = true;
        video.autoplay = true;
        try {
            await video.play();
            return true;
        } catch (err) {
            console.warn("video.play() blocked:", err);
            setNeedsPlayTap(true);
            return false;
        }
    };

    // user tap handler to unblock playback
    const handleTapToPlay = async () => {
        setNeedsPlayTap(false);
        await attemptPlay(localVideoRef.current);
        await attemptPlay(remoteVideoRef.current);
    };

    // cleanup on unmount
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

    const handleJoinRoom = async (roomId: string) => {
        if (joining || connected) return;
        setJoining(true);
        setSelectedRoom(roomId);
        setStatus("Getting camera...");

        try {
            // --- 1) Get local media (keep constraints simple for mobile)
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: true,
            });
            localStreamRef.current = localStream;

            // Attach local preview (muted to allow autoplay)
            if (localVideoRef.current) {
                const lv = localVideoRef.current;
                lv.srcObject = localStream;
                lv.muted = true; // critical for autoplay on Android/iOS
                lv.playsInline = true;
                lv.onloadedmetadata = () => {
                    attemptPlay(lv).catch(() => { });
                };
            }

            setStatus("Creating RTCPeerConnection...");
            const pc = new RTCPeerConnection(rtcConfig);
            pcRef.current = pc;

            // Add local tracks
            localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

            // Persistent remote stream so element always has srcObject
            const persistentRemote = new MediaStream();
            persistentRemoteRef.current = persistentRemote;
            if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                remoteVideoRef.current.srcObject = persistentRemote;
            }

            // ontrack: prefer event.streams[0] (best for Safari), otherwise add to persistent stream
            pc.ontrack = (event) => {
                console.log("ontrack:", event.track.kind, event.track.id, "streams:", event.streams?.length);
                const el = remoteVideoRef.current;

                if (event.streams && event.streams.length > 0 && el) {
                    // attach the provided stream directly (works better on some browsers)
                    el.srcObject = event.streams[0];
                    el.onloadedmetadata = () => attemptPlay(el).catch(() => { });
                } else {
                    // fallback: add track to persistent remote stream
                    const prs = persistentRemoteRef.current!;
                    if (!prs.getTracks().some((tk) => tk.id === event.track.id)) {
                        prs.addTrack(event.track);
                    }
                    if (el) el.onloadedmetadata = () => attemptPlay(el).catch(() => { });
                }
            };

            // connection state monitoring
            pc.onconnectionstatechange = () => {
                console.log("pc.connectionState:", pc.connectionState);
                setStatus(`Connection: ${pc.connectionState}`);
                if (pc.connectionState === "connected") {
                    setConnected(true);
                    setJoining(false);
                    setStatus("Connected!");
                    // attempt play again (in case blocked earlier)
                    attemptPlay(remoteVideoRef.current).catch(() => { });
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log("ICE state:", pc.iceConnectionState);
                setStatus(`ICE: ${pc.iceConnectionState}`);
                if (pc.iceConnectionState === "disconnected") {
                    console.warn("ICE disconnected — check network / TURN");
                }
            };

            setStatus("Joining room (signaling) ...");

            // SDP filter to avoid VP9/AV1/H265 (better for Safari)
            const sdpFilter = (sdp: string) =>
                sdp
                    .replace(/a=rtpmap:\d+ VP9\/90000\r\n/g, "")
                    .replace(/a=rtpmap:\d+ AV1\/90000\r\n/g, "")
                    .replace(/a=rtpmap:\d+ H265\/90000\r\n/g, "");

            // joinRoom is expected to: set remote description (offer), write answer, and add remote ICE candidates to pc.
            await joinRoom(roomId, pc, sdpFilter);

            setStatus("Waiting for remote media...");
            setJoining(false);

            // If remote tracks already arrived, try playing
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

    // Connected view
    if (connected && selectedRoom) {
        return (
            <div className="w-full h-screen bg-gray-900 text-white relative">
                {/* Local preview */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: "scaleX(-1)" }}
                    className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800 block"
                />

                {/* Remote main */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-gray-800 block"
                />

                {/* Hangup */}
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
            </div>
        );
    }

    // Waiting dashboard
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent Dashboard</h1>
                <p className="text-gray-600 mb-8">
                    {rooms.length > 0 ? `${rooms.length} waiting customer${rooms.length === 1 ? "" : "s"}` : "No customers waiting"}
                </p>

                {joining && (
                    <div className="mb-8 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3"></div>
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
                                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
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
                        <button
                            onClick={handleTapToPlay}
                            className="bg-black/80 text-white px-6 py-3 rounded-lg text-lg"
                        >
                            ▶ Tap to enable video
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
