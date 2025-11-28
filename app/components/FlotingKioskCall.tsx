"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function FloatingKioskCall() {
    const router = useRouter();

    const [mode, setMode] = useState<"hidden" | "full" | "mini">("hidden");
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);

    useEffect(() => {
        function openCall() {
            console.log("📞 FULL mode");
            setMode("full");
        }

        window.addEventListener("open-call", openCall);

        function handleMessage(e: any) {
            if (e.data?.type === "KIOSK_CONNECTED") {
                console.log("📬 Received KIOSK_CONNECTED");

                // Change size only — keep same iframe session
                setMode("mini");

                // NOW you can redirect parent safely
                router.push("/choose-service");
            }
        }

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("open-call", openCall);
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    // Load kiosk only once, never again
    useEffect(() => {
        if (iframeRef.current && !iframeLoaded) {
            iframeRef.current.src = "/kiosk";
            setIframeLoaded(true);
        }
    }, [iframeLoaded]);

    if (mode === "hidden") return null;

    return (
        <iframe
            ref={iframeRef}
            allow="camera *; microphone *; fullscreen *; autoplay *; display-capture *"
            className={`
                fixed z-[9999] bg-black rounded-xl shadow-xl border border-white
                transition-all duration-300
                ${mode === "full"
                    ? "inset-0 w-[92vw] h-[92vh] m-auto"
                    : "bottom-4 right-4 w-[260px] h-[150px]"}
            `}
        />
    );
}
