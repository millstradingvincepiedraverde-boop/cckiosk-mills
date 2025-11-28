// app/agent/page.tsx - Dashboard only
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Room {
    id: string;
    offer?: any;
    answer?: any;
    createdAt?: string;
}

export default function AgentDashboard() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const router = useRouter();

    useEffect(() => {
        console.log("👂 Listening for available rooms...");
        
        const roomsRef = collection(firestore, "rooms");
        const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
            const availableRooms = snapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        offer: data.offer,
                        answer: data.answer,
                        createdAt: data.createdAt
                    };
                })
                .filter((room) => !room.answer) // Only show unanswered rooms
                .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });

            console.log("📋 Available rooms:", availableRooms.length);
            setRooms(availableRooms);
        });

        return () => unsubscribe();
    }, []);

    const handleJoinRoom = (roomId: string) => {
        // Navigate to call page
        router.push(`/agent/call/${roomId}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    Agent Dashboard
                </h1>
                <p className="text-gray-600 mb-8">
                    {rooms.length > 0
                        ? `${rooms.length} waiting customer${rooms.length === 1 ? "" : "s"}`
                        : "No customers waiting"}
                </p>

                {rooms.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-12 text-center">
                        <div className="text-6xl mb-4">💤</div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                            No Active Calls
                        </h2>
                        <p className="text-gray-500">
                            Waiting for customers to initiate calls...
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Customer Waiting
                                            </h3>
                                        </div>
                                        <p className="text-sm text-gray-500 font-mono">
                                            Room: {room.id.slice(0, 12)}...
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Created:{" "}
                                            {room.createdAt
                                                ? new Date(room.createdAt).toLocaleTimeString()
                                                : "Just now"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleJoinRoom(room.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                    >
                                        Join Call
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}