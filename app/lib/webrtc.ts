// app/lib/webrtc.ts - Complete fix with proper signaling
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    setDoc,
    addDoc,
    getDoc,
    onSnapshot,
} from "firebase/firestore";

// 🔥 Global guard to prevent duplicate room creation
let roomCreationInProgress = false;
let activeRoomId: string | null = null;

export async function createRoom(peerConnection: RTCPeerConnection): Promise<string> {
    // Check if already creating a room
    if (roomCreationInProgress && activeRoomId) {
        console.log("⚠️ Room creation already in progress, returning existing room:", activeRoomId);
        return activeRoomId;
    }

    // Set flag immediately to block concurrent calls
    roomCreationInProgress = true;
    console.log("✅ Starting room creation...");

    try {
        // Create room document reference
        const roomRef = doc(collection(db, "rooms"));
        const roomId = roomRef.id;
        activeRoomId = roomId;

        console.log("📝 Room ID generated:", roomId);

        // IMPORTANT: Set up ICE candidate handler BEFORE creating offer
        const callerCandidates = collection(roomRef, "callerCandidates");
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 [CALLER] New ICE candidate:", event.candidate.candidate);
                addDoc(callerCandidates, event.candidate.toJSON()).then(() => {
                    console.log("💾 [CALLER] ICE candidate saved to Firestore");
                });
            } else {
                console.log("🧊 [CALLER] ICE gathering complete");
            }
        };

        // Listen for callee ICE candidates BEFORE creating offer
        const calleeCandidatesRef = collection(roomRef, "calleeCandidates");
        onSnapshot(calleeCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    console.log("🧊 [CALLER] Received remote ICE candidate:", data);
                    const candidate = new RTCIceCandidate(data);
                    peerConnection.addIceCandidate(candidate)
                        .then(() => console.log("✅ [CALLER] Remote ICE candidate added"))
                        .catch(e => console.error("❌ [CALLER] Error adding ICE candidate:", e));
                }
            });
        });

        // 1. Create Offer
        console.log("📤 Creating offer...");
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        console.log("📤 Setting local description...");
        await peerConnection.setLocalDescription(offer);
        console.log("✅ Local description set:", offer.type);

        // Save offer to Firestore
        const roomData = {
            offer: {
                type: offer.type,
                sdp: offer.sdp,
            },
            createdAt: new Date().toISOString()
        };

        console.log("💾 Saving offer to Firestore...");
        await setDoc(roomRef, roomData);
        console.log("✅ Offer saved to Firestore");

        // 2. Listen for Answer
        console.log("👂 Listening for answer...");
        onSnapshot(roomRef, async (snapshot) => {
            const data = snapshot.data();
            if (data?.answer && !peerConnection.currentRemoteDescription) {
                console.log("📥 [CALLER] Answer received!");
                console.log("📥 Answer type:", data.answer.type);
                console.log("📥 Answer SDP length:", data.answer.sdp?.length);

                const answer = new RTCSessionDescription(data.answer);
                try {
                    await peerConnection.setRemoteDescription(answer);
                    console.log("✅ [CALLER] Remote description set successfully!");
                } catch (e) {
                    console.error("❌ [CALLER] Error setting remote description:", e);
                }
            }
        });

        console.log("🎉 Room setup complete:", roomId);
        return roomId;

    } catch (error) {
        console.error("❌ Error creating room:", error);
        activeRoomId = null;
        throw error;
    } finally {
        // Reset flag after a delay to allow legitimate retries if needed
        setTimeout(() => {
            console.log("🔓 Room creation lock released");
            roomCreationInProgress = false;
        }, 2000);
    }
}

export async function joinRoom(roomId: string, peerConnection: RTCPeerConnection, p0: (sdp: any) => any): Promise<void> {
    try {
        console.log("🚪 Joining room:", roomId);

        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error("Room doesn't exist");
        }

        const roomData = roomSnap.data();

        if (!roomData?.offer) {
            throw new Error("No offer found in room");
        }

        console.log("📥 [CALLEE] Offer received!");
        console.log("📥 Offer type:", roomData.offer.type);
        console.log("📥 Offer SDP length:", roomData.offer.sdp?.length);

        // IMPORTANT: Set up ICE candidate handler BEFORE setting remote description
        const calleeCandidates = collection(roomRef, "calleeCandidates");
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 [CALLEE] New ICE candidate:", event.candidate.candidate);
                addDoc(calleeCandidates, event.candidate.toJSON()).then(() => {
                    console.log("💾 [CALLEE] ICE candidate saved to Firestore");
                });
            } else {
                console.log("🧊 [CALLEE] ICE gathering complete");
            }
        };

        // Listen for caller ICE candidates BEFORE setting remote description
        const callerCandidatesRef = collection(roomRef, "callerCandidates");
        onSnapshot(callerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    console.log("🧊 [CALLEE] Received remote ICE candidate:", data);
                    const candidate = new RTCIceCandidate(data);
                    peerConnection.addIceCandidate(candidate)
                        .then(() => console.log("✅ [CALLEE] Remote ICE candidate added"))
                        .catch(e => console.error("❌ [CALLEE] Error adding ICE candidate:", e));
                }
            });
        });

        // 1. Set Offer → create Answer
        console.log("📥 [CALLEE] Setting remote description (offer)...");
        const offer = new RTCSessionDescription(roomData.offer);
        await peerConnection.setRemoteDescription(offer);
        console.log("✅ [CALLEE] Remote description set");

        console.log("📤 [CALLEE] Creating answer...");
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        console.log("📤 [CALLEE] Setting local description...");
        await peerConnection.setLocalDescription(answer);
        console.log("✅ [CALLEE] Local description set:", answer.type);

        // Save answer to Firestore
        console.log("💾 [CALLEE] Saving answer to Firestore...");
        await setDoc(roomRef, {
            answer: {
                type: answer.type,
                sdp: answer.sdp,
            }
        }, { merge: true });
        console.log("✅ [CALLEE] Answer saved to Firestore");

        console.log("🎉 Successfully joined room");

    } catch (error) {
        console.error("❌ Error joining room:", error);
        throw error;
    }
}

// Cleanup function to reset state
export function resetRoomState() {
    roomCreationInProgress = false;
    activeRoomId = null;
    console.log("🧹 Room state reset");
}