export const rtcConfig: RTCConfiguration = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:global.stun.twilio.com:3478"
            ]
        },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "turnuser",
            credential: "turnpassword",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "turnuser",
            credential: "turnpassword",
        },
        {
            urls: "turn:global.relay.metered.ca:443?transport=tcp",
            username: "turnuser",
            credential: "turnpassword",
        }
    ],
    iceCandidatePoolSize: 10,
};
