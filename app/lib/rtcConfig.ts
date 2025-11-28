export const rtcConfig: RTCConfiguration = {
    iceServers: [
        // Public STUN servers (iOS requires at least one)
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },

        // TURN server for relaying media if STUN fails
        {
            urls: [
                "turn:openrelay.metered.ca:80?transport=udp",
                "turn:openrelay.metered.ca:443?transport=tcp",
                "turn:openrelay.metered.ca:443?transport=udp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],

    // iOS Safari can benefit from a larger candidate pool
    iceCandidatePoolSize: 10
};
