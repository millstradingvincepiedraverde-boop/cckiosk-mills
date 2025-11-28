"use client";

import { useEffect, useState } from "react";

export default function FloatingKioskCall() {
    const [mode, setMode] = useState<"hidden" | "full" | "mini">("hidden");
    const [roomId, setRoomId] = useState<string | null>(null);

    useEffect(() => {
        function openCall() {
            console.log("📞 Opening kiosk in FULL mode...");
            setMode("full");
        }

        window.addEventListener("open-call", openCall);

        function handleMessage(e: any) {
            if (e.data?.type === "KIOSK_CONNECTED") {
                console.log("📬 Parent received: KIOSK_CONNECTED");

                setRoomId(e.data.roomId);

                // Switch to MINI mode
                setMode("mini");

                window.location.href = "/choose-service";


            }
        }

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("open-call", openCall);
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    if (mode === "hidden") return null;

    return (
        <>
            {/* FULL-SCREEN MODE */}
            {mode === "full" && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
                    <div className="relative w-[92vw] h-[92vh] bg-black rounded-xl shadow-xl overflow-hidden">

                        <iframe
                            src="/kiosk"
                            allow="camera *; microphone *; fullscreen *; autoplay *; display-capture *"
                            allowFullScreen
                            className="w-full h-full"
                        />
                    </div>
                </div>
            )}

            {/* MINI FLOATING WINDOW (Picture-in-Picture) */}
            {mode === "mini" && (
                <div
                    className="
                        fixed bottom-4 right-4
                        w-[260px] h-[150px]
                        bg-black rounded-lg shadow-xl border border-white
                        overflow-hidden z-[9999]
                    "
                >
                    <iframe
                        src="/kiosk"
                        allow="camera *; microphone *; fullscreen *; autoplay *; display-capture *"
                        allowFullScreen
                        className="w-full h-full pointer-events-none"
                    />
                </div>
            )}
        </>
    );
}
