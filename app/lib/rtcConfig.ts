export const rtcConfig: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ]
        },
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

    iceCandidatePoolSize: 10
};
