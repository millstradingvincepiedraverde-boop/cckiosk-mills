"use client";

import { useEffect, useState } from "react";

export default function FloatingKioskCall() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        function openCall() {
            setVisible(true);
        }

        // Listen for "open-call"
        window.addEventListener("open-call", openCall);

        // Listen for kiosk → parent message
        function handleMessage(e: any) {
            if (e.data?.type === "KIOSK_CONNECTED") {
                // Hide iframe and continue kiosk flow
                setVisible(false);
                window.location.href = "/choose-service"; // or router.push
            }
        }
        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("open-call", openCall);
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
            <iframe
                src="/kiosk"
                allow="camera *; microphone *; fullscreen *; autoplay *; display-capture *"
                allowFullScreen
                className="w-[90vw] h-[90vh] bg-black rounded-xl shadow-xl border border-white"
            />
        </div>
    );
}
