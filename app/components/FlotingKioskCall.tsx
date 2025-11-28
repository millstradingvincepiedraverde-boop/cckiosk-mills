"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function FloatingKioskCall() {
    const router = useRouter();

    const [mode, setMode] = useState<"hidden" | "full" | "mini">("hidden");
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Load kiosk ONCE only
    useEffect(() => {
        if (iframeRef.current) {
            console.log("🔵 Loading /kiosk...");
            iframeRef.current.src = "/kiosk";
        }
    }, []);

    // Listeners
    useEffect(() => {
        function openCall() {
            console.log("🟢 open-call RECEIVED → opening FULL mode");
            setMode("full");
        }

        window.addEventListener("open-call", openCall);

        function handleMessage(e: any) {
            if (e.data?.type === "KIOSK_CONNECTED") {
                console.log("🟢 Parent: Received KIOSK_CONNECTED");

                // shrink iframe
                setMode("mini");

                // go to next page
                router.push("/choose-service");
            }
        }

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("open-call", openCall);
            window.removeEventListener("message", handleMessage);
        };
    }, []);

    if (mode === "hidden") {
        return null;
    }

    return (
        <iframe
            ref={iframeRef}
            allow="camera *; microphone *; fullscreen *; autoplay *; display-capture *"
            className={`
                fixed z-[9999] bg-black rounded-xl shadow-xl border border-white
                transition-all duration-300 ease-in-out
                ${mode === "full"
                    ? "inset-0 w-[92vw] h-[92vh] m-auto"
                    : "bottom-4 right-4 w-[260px] h-[150px]"}
            `}
        />
    );
}
