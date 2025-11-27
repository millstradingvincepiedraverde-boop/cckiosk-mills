"use client";

import { db } from "@/app/firebase"
import { doc, setDoc } from "firebase/firestore";

export default function TestFirebase() {
  async function testWrite() {
    await setDoc(doc(db, "test", "hello"), {
      time: new Date().toISOString(),
    });
    alert("Firestore write success!");
  }

  return (
    <button onClick={testWrite} className="p-4 bg-green-600 text-white">
      Test Firebase
    </button>
  );
}
