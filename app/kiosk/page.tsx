// app/kiosk/page.tsx - Simplified and Fixed
"use client";

import { useEffect, useRef, useState } from "react";
import { rtcConfig } from "@/app/lib/rtcConfig";
import { createRoom } from "@/app/lib/webrtc";

// 🔥 Module-level guards to prevent duplicate room creation
let kioskStarted = false;

export default function KioskPage() {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const startedRef = useRef(false);

    const [connected, setConnected] = useState(false);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("Initializing...");

    useEffect(() => {
        if (kioskStarted || startedRef.current) {
            console.log("❌ Blocked duplicate kiosk initialization");
            return;
        }

        kioskStarted = true;
        startedRef.current = true;

        console.log("✅ Initializing kiosk...");

        async function startCall() {
            try {
                setStatus("Getting camera access...");

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
                }

                setStatus("Creating peer connection...");

                // 2. Create peer connection
                const peer = new RTCPeerConnection(rtcConfig);
                peerRef.current = peer;

                console.log("🔌 Peer connection created");

                // 3. Add local tracks to peer connection
                localStream.getTracks().forEach((track) => {
                    console.log("➕ Adding local track:", track.kind, track.label);
                    peer.addTrack(track, localStream);
                });

                // 4. Set up remote stream
                const remoteStream = new MediaStream();
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }

                peer.ontrack = (event) => {
                    console.log("📺 ===== RECEIVED REMOTE TRACK =====");
                    console.log("📺 Kind:", event.track.kind);
                    console.log("📺 Label:", event.track.label);
                    console.log("📺 ReadyState:", event.track.readyState);

                    event.streams[0].getTracks().forEach((track) => {
                        console.log("➕ Adding remote track to stream:", track.kind);
                        remoteStream.addTrack(track);
                    });
                };

                // 5. Monitor connection state
                peer.onconnectionstatechange = () => {
                    console.log("🔗 Connection state:", peer.connectionState);
                    setStatus(`Connection: ${peer.connectionState}`);

                    if (peer.connectionState === "connected") {
                        console.log("🎉 CONNECTED!");
                        setConnected(true);
                        setStatus("Connected!");
                    } else if (peer.connectionState === "failed") {
                        setError("Connection failed");
                        setStatus("Connection failed");
                    }
                };

                peer.oniceconnectionstatechange = () => {
                    console.log("🧊 ICE state:", peer.iceConnectionState);
                };

                peer.onicegatheringstatechange = () => {
                    console.log("📡 ICE gathering state:", peer.iceGatheringState);
                };

                setStatus("Creating room...");

                // 6. Create room
                const newRoomId = await createRoom(peer);
                console.log("🎉 Room created:", newRoomId);
                setRoomId(newRoomId);
                setStatus("Waiting for agent to join...");

            } catch (err) {
                console.error("❌ Error starting call:", err);
                setError(err instanceof Error ? err.message : "Failed to start call");
                setStatus("Error: " + (err instanceof Error ? err.message : "Unknown error"));
            }
        }

        const timer = setTimeout(startCall, 500);

        return () => {
            clearTimeout(timer);
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (peerRef.current) {
                peerRef.current.close();
            }
        };
    }, []);

    return (
        <div className="w-full h-screen bg-gray-900 text-white relative overflow-hidden">
            {/* Local video (small preview) */}
            <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ transform: 'scaleX(-1)' }}
                className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800"
            />

            {/* Remote video (main) */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover bg-gray-800"
            />

            {/* Status overlay */}
            <div className="absolute top-4 left-4 bg-black/80 p-4 rounded-lg max-w-md">
                <div className="text-sm font-mono">
                    <div className="mb-2">
                        <span className="text-gray-400">Room ID:</span>{" "}
                        <span className="text-green-400">{roomId || "Creating..."}</span>
                    </div>
                    <div className="mb-2">
                        <span className="text-gray-400">Status:</span>{" "}
                        <span className={connected ? "text-green-400" : "text-yellow-400"}>
                            {status}
                        </span>
                    </div>
                    {error && (
                        <div className="text-red-400 text-xs mt-2">
                            Error: {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Continue button (appears when connected) */}
            {connected && (
                <button
                    className="absolute bottom-0 left-0 right-0 w-full bg-green-600 hover:bg-green-700 py-6 text-2xl font-bold transition-colors shadow-lg"
                    onClick={() => {
                        window.parent.postMessage(
                            { type: "KIOSK_CONNECTED", roomId: roomId },
                            "*"
                        );
                    }}
                >
                    ✓ Continue with Agent
                </button>
            )}

            {/* Debug info */}
            {process.env.NODE_ENV === "development" && (
                <div className="absolute top-4 right-4 bg-black/80 p-3 rounded text-xs font-mono max-w-xs">
                    <div>Peer: {peerRef.current?.connectionState || "none"}</div>
                    <div>ICE: {peerRef.current?.iceConnectionState || "none"}</div>
                    <div>Local tracks: {localStreamRef.current?.getTracks().length || 0}</div>
                </div>
            )}
        </div>
    );
}