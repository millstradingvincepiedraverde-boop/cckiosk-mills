export const rtcConfig: RTCConfiguration = {
    iceServers: [
        // Public STUN servers (required for iOS and mobile)
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },

        // TURN server for relaying media if STUN fails
        {
            urls: [
                "turn:openrelay.metered.ca:80?transport=udp",   // UDP fallback
                "turn:openrelay.metered.ca:443?transport=tcp",  // TCP for mobile networks
                "turns:openrelay.metered.ca:443?transport=tcp"  // TLS secure for iOS/Android
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],

    // iOS Safari can benefit from a larger candidate pool
    iceCandidatePoolSize: 10
};
