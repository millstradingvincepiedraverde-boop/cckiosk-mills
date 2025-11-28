// app/agent/call/[roomId]/page.tsx - Call interface only
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { rtcConfig } from "@/app/lib/rtcConfig";
import { joinRoom } from "@/app/lib/webrtc";

export default function AgentCallPage() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.roomId as string;

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState("Initializing...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function initCall() {
            try {
                setStatus("Requesting camera access...");

                // 1. Get local media
                const localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                localStreamRef.current = localStream;

                if (!mounted) {
                    localStream.getTracks().forEach(t => t.stop());
                    return;
                }

                console.log("✅ Got local stream");

                // 2. Attach local video
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                    localVideoRef.current.play().catch(console.warn);
                }

                setStatus("Creating peer connection...");

                // 3. Create peer connection
                const pc = new RTCPeerConnection(rtcConfig);
                pcRef.current = pc;

                // 4. Set up remote video FIRST
                const remoteStream = new MediaStream();
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }

                pc.ontrack = (event) => {
                    console.log("📺 Received track:", event.track.kind);
                    event.streams[0].getTracks().forEach((track) => {
                        remoteStream.addTrack(track);
                    });

                    // Force play remote video
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.play().catch(console.warn);
                    }
                };

                // 5. Add local tracks
                localStream.getTracks().forEach((track) => {
                    pc.addTrack(track, localStream);
                });

                // 6. Monitor connection
                pc.onconnectionstatechange = () => {
                    console.log("🔗 Connection state:", pc.connectionState);
                    setStatus(`Connection: ${pc.connectionState}`);

                    if (pc.connectionState === "connected") {
                        setConnected(true);
                        setStatus("Connected!");
                    } else if (pc.connectionState === "failed") {
                        setError("Connection failed");
                    }
                };

                setStatus("Joining room...");

                // 7. Join room
                await joinRoom(roomId, pc);

                console.log("🎉 Joined room successfully");

            } catch (err) {
                console.error("❌ Error:", err);
                setError(err instanceof Error ? err.message : "Failed to initialize call");
                setStatus("Error");
            }
        }

        initCall();

        // Cleanup
        return () => {
            mounted = false;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            pcRef.current?.close();
        };
    }, [roomId]);

    const handleEndCall = () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        router.push("/agent"); // Back to dashboard
    };

    if (error) {
        return (
            <div className="w-full h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={handleEndCall}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-gray-900 text-white relative">
            {/* Local video (small) */}
            <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ transform: "scaleX(-1)" }}
                className="absolute w-48 h-48 bottom-4 right-4 rounded-lg shadow-lg z-10 border-2 border-green-500 object-cover bg-gray-800"
            />

            {/* Remote video (main) */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover bg-gray-800"
            />

            {/* Status overlay (while connecting) */}
            {!connected && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                        <div className="text-xl">{status}</div>
                    </div>
                </div>
            )}

            {/* Call controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <div className="text-sm text-gray-300">
                        Room: {roomId.slice(0, 8)}...
                    </div>

                    <button
                        onClick={handleEndCall}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-semibold transition-colors shadow-lg"
                    >
                        📞 End Call
                    </button>

                    <div className={`text-sm ${connected ? "text-green-400" : "text-yellow-400"}`}>
                        {connected ? "● Connected" : "○ Connecting..."}
                    </div>
                </div>
            </div>
        </div>
    );
}