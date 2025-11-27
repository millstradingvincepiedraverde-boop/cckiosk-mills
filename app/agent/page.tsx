// app/agent/page.tsx - Simplified and Fixed
"use client";

import { useEffect, useRef, useState } from "react";
import { rtcConfig } from "@/app/lib/rtcConfig";
import { joinRoom } from "@/app/lib/webrtc";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "@/app/firebase";

interface Room {
    id: string;
    offer?: any;
    answer?: any;
    createdAt?: string;
}

export default function AgentPage() {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [joining, setJoining] = useState(false);
    const [status, setStatus] = useState("idle");

    // Listen for available rooms
    useEffect(() => {
        console.log("👂 Listening for available rooms...");

        const roomsRef = collection(firestore, "rooms");
        const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
            const availableRooms = snapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        offer: data.offer,
                        answer: data.answer,
                        createdAt: data.createdAt
                    };
                })
                .filter((room) => !room.answer) // Only show rooms without an answer
                .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });

            console.log("📋 Available rooms:", availableRooms.length);
            setRooms(availableRooms);
        });

        return () => unsubscribe();
    }, []);

    const handleJoinRoom = async (roomId: string) => {
        if (joining || connected) return;

        setJoining(true);
        setSelectedRoom(roomId);
        setStatus("Getting camera...");

        try {
            console.log("🚪 Joining room:", roomId);

            // 1. Get local media FIRST
            console.log("🎥 Requesting media devices...");
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localStreamRef.current = localStream;

            console.log("✅ Media devices acquired");
            console.log("📹 Video tracks:", localStream.getVideoTracks().map(t => t.label));
            console.log("🎤 Audio tracks:", localStream.getAudioTracks().map(t => t.label));

            // Set local video
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStream;
                console.log("📹 Local video srcObject set");

                // Force play
                try {
                    await localVideoRef.current.play();
                    console.log("✅ Local video playing");
                } catch (e) {
                    console.error("❌ Local video play error:", e);
                }
            }

            setStatus("Creating peer connection...");

            // 2. Create peer connection
            const peer = new RTCPeerConnection(rtcConfig);
            peerRef.current = peer;

            console.log("🔌 Peer connection created");

            // 3. Add local tracks
            localStream.getTracks().forEach((track) => {
                console.log("➕ Adding local track:", track.kind, track.label);
                peer.addTrack(track, localStream);
            });

            // 4. Set up remote stream
            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                console.log("📺 Remote video srcObject set");
            }

            peer.ontrack = (event) => {
                console.log("📺 ===== RECEIVED REMOTE TRACK =====");
                console.log("📺 Kind:", event.track.kind);
                console.log("📺 Label:", event.track.label);
                console.log("📺 ReadyState:", event.track.readyState);
                console.log("📺 Enabled:", event.track.enabled);
                console.log("📺 Muted:", event.track.muted);

                event.streams[0].getTracks().forEach((track) => {
                    console.log("➕ Adding remote track to stream:", track.kind);
                    remoteStream.addTrack(track);
                });

                // Force play remote video
                if (remoteVideoRef.current) {
                    console.log("🎬 Attempting to play remote video...");
                    remoteVideoRef.current.play()
                        .then(() => console.log("✅ Remote video playing"))
                        .catch(e => console.error("❌ Remote video play error:", e));
                }
            };

            // 5. Monitor connection state
            peer.onconnectionstatechange = () => {
                console.log("🔗 Connection state:", peer.connectionState);
                setStatus(`Connection: ${peer.connectionState}`);

                if (peer.connectionState === "connected") {
                    console.log("🎉 CONNECTED!");
                    setConnected(true);
                    setJoining(false);
                    setStatus("Connected!");
                }
            };

            peer.oniceconnectionstatechange = () => {
                console.log("🧊 ICE state:", peer.iceConnectionState);
            };

            peer.onicegatheringstatechange = () => {
                console.log("📡 ICE gathering state:", peer.iceGatheringState);
            };

            setStatus("Joining room...");

            // 6. Join the room
            await joinRoom(roomId, peer);
            console.log("✅ Joined room successfully");
            setStatus("Waiting for connection...");

        } catch (error) {
            console.error("❌ Error joining room:", error);
            setJoining(false);
            setSelectedRoom(null);
            setStatus("idle");
            alert("Failed to join room: " + (error instanceof Error ? error.message : "Unknown error"));
        }
    };

    const handleHangup = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerRef.current) {
            peerRef.current.close();
        }

        setConnected(false);
        setSelectedRoom(null);
        setJoining(false);
        setStatus("idle");
    };

    if (connected && selectedRoom) {
        return (
            <div className="w-full h-screen bg-gray-900 text-white relative">
                {/* Local video */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: 'scaleX(-1)' }}
                    className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800"
                    onLoadedMetadata={(e) => {
                        console.log("📹 Local video metadata loaded:", e.currentTarget.videoWidth, "x", e.currentTarget.videoHeight);
                    }}
                    onPlay={() => console.log("▶️ Local video started playing")}
                />

                {/* Remote video */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-gray-800"
                    onLoadedMetadata={(e) => {
                        console.log("📺 Remote video metadata loaded:", e.currentTarget.videoWidth, "x", e.currentTarget.videoHeight);
                    }}
                    onPlay={() => console.log("▶️ Remote video started playing")}
                />

                {/* Hangup button */}
                <button
                    onClick={handleHangup}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-semibold transition-colors shadow-lg z-20"
                >
                    📞 End Call
                </button>

                {/* Status */}
                <div className="absolute top-4 left-4 bg-black/80 p-4 rounded-lg z-20">
                    <div className="text-sm text-gray-300">Room: {selectedRoom.slice(0, 8)}...</div>
                    <div className="text-green-500 font-semibold">● Connected</div>
                </div>

                {/* Debug info */}
                {process.env.NODE_ENV === "development" && (
                    <div className="absolute top-4 right-4 bg-black/80 p-3 rounded text-xs font-mono max-w-xs z-20">
                        <div>Peer: {peerRef.current?.connectionState || "none"}</div>
                        <div>ICE: {peerRef.current?.iceConnectionState || "none"}</div>
                        <div>Local tracks: {localStreamRef.current?.getTracks().length || 0}</div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent Dashboard</h1>
                <p className="text-gray-600 mb-8">
                    {rooms.length > 0
                        ? `${rooms.length} waiting customer${rooms.length === 1 ? "" : "s"}`
                        : "No customers waiting"}
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
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                            No Active Calls
                        </h2>
                        <p className="text-gray-500">
                            Waiting for customers to initiate calls...
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Customer Waiting
                                            </h3>
                                        </div>
                                        <p className="text-sm text-gray-500 font-mono">
                                            Room: {room.id.slice(0, 12)}...
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Created: {room.createdAt
                                                ? new Date(room.createdAt).toLocaleTimeString()
                                                : "Just now"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleJoinRoom(room.id)}
                                        disabled={joining}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        {joining && selectedRoom === room.id
                                            ? "Joining..."
                                            : "Join Call"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}