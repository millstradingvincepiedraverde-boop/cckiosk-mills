"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function FloatingKioskCall() {
    const router = useRouter();
    const [mode, setMode] = useState<"hidden" | "full" | "mini">("hidden");
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Load kiosk ONLY ONCE
    useEffect(() => {
        if (iframeRef.current) {
            console.log("🎥 Loading kiosk once...");
            iframeRef.current.src = "/kiosk";        // ← stays forever
        }
    }, []);

    useEffect(() => {
        function openCall() {
            console.log("📞 FULL MODE");
            setMode("full");
        }

        window.addEventListener("open-call", openCall);

        function handleMessage(e: any) {
            if (e.data?.type === "KIOSK_CONNECTED") {
                console.log("📬 MINI MODE - DO NOT RELOAD IFRAME");

                setMode("mini");               // ← only resizes; iframe stays alive
                router.push("/choose-service");
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
        <iframe
            ref={iframeRef}
            allow="camera *; microphone *; autoplay *; fullscreen *; display-capture *"
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
