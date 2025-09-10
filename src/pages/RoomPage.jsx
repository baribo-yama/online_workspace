// src/pages/RoomPage.jsx
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { defaultParticipant } from "../models/firestore";  // ★ 追加

function RoomPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const userName = state?.name || "Guest";

  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const [room, setRoom] = useState(null);

  const endRoom = async () => {
    await deleteDoc(doc(db, "rooms", roomId));
    navigate("/");
  };

  const leaveRoom = async () => {
    if (myParticipantId) {
      await deleteDoc(doc(db, "rooms", roomId, "participants", myParticipantId));
    }
    navigate("/");
  };

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data());
      }
    });

    const join = async () => {
      const docRef = await addDoc(collection(db, "rooms", roomId, "participants"), {
        ...defaultParticipant(userName),
        joinedAt: serverTimestamp(),
      });
      setMyParticipantId(docRef.id);
    };
    join();

    const unsubParticipants = onSnapshot(
      collection(db, "rooms", roomId, "participants"),
      (snapshot) => {
        const users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setParticipants(users);
      }
    );

    return () => {
      unsubRoom();
      unsubParticipants();
    };
  }, [roomId, userName]);

  return (
    <div>
      <h1>{room ? room.title : "Loading..."}</h1>
      <p>Room ID: {roomId}</p>

      <button onClick={endRoom}>End Room</button>
      <button onClick={leaveRoom}>Leave Room</button>

      <h2>Participants</h2>
      <ul>
        {participants.map((p) => (
          <li key={p.id}>
            {p.name || "Unknown"} - {p.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RoomPage;
