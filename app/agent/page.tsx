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
        const roomsRef = collection(firestore, "rooms");
        const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
            const availableRooms = snapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        offer: data.offer,
                        answer: data.answer,
                        createdAt: data.createdAt,
                    };
                })
                .filter((room) => !room.answer)
                .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });

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
            // 1️⃣ Get local media with constraints
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true,
            });
            localStreamRef.current = localStream;

            // 2️⃣ Display local video
            if (localVideoRef.current) {
                const videoEl = localVideoRef.current;
                videoEl.srcObject = localStream;
                videoEl.muted = true;
                videoEl.playsInline = true;

                videoEl.onloadedmetadata = () => {
                    setTimeout(() => {
                        videoEl.play().catch((e) => console.warn("❌ Local video play error", e));
                    }, 50);
                };
            }

            setStatus("Creating peer connection...");

            // 3️⃣ Create peer connection
            const peer = new RTCPeerConnection(rtcConfig);
            peerRef.current = peer;

            // 4️⃣ Add local tracks
            localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

            // 5️⃣ Set up remote stream
            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

            peer.ontrack = (event) => {
                console.log("📺 Remote track received:", event.track.kind);
                remoteStream.addTrack(event.track);

                if (remoteVideoRef.current) {
                    const videoEl = remoteVideoRef.current;
                    videoEl.srcObject = remoteStream;
                    videoEl.onloadedmetadata = () => {
                        videoEl.play().catch((e) => console.error("❌ Remote video play error", e));
                    };
                }
            };

            // 6️⃣ Monitor connection
            peer.onconnectionstatechange = () => {
                setStatus(`Connection: ${peer.connectionState}`);
                if (peer.connectionState === "connected") {
                    setConnected(true);
                    setJoining(false);
                    setStatus("Connected!");
                }
            };

            peer.oniceconnectionstatechange = () => console.log("🧊 ICE state:", peer.iceConnectionState);
            peer.onicegatheringstatechange = () => console.log("📡 ICE gathering state:", peer.iceGatheringState);

            setStatus("Joining room...");

            // 7️⃣ Join the room
            await joinRoom(roomId, peer);
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
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        peerRef.current?.close();

        setConnected(false);
        setSelectedRoom(null);
        setJoining(false);
        setStatus("idle");
    };

    // Connected view
    if (connected && selectedRoom) {
        return (
            <div className="w-full h-screen bg-gray-900 text-white relative">
                {/* Local video */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ transform: "scaleX(-1)" }}
                    className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800"
                />

                {/* Remote video */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-gray-800"
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
            </div>
        );
    }

    // Waiting dashboard view
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
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Active Calls</h2>
                        <p className="text-gray-500">Waiting for customers to initiate calls...</p>
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
                                            <h3 className="text-lg font-semibold text-gray-900">Customer Waiting</h3>
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
                                        {joining && selectedRoom === room.id ? "Joining..." : "Join Call"}
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
