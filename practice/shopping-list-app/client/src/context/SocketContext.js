import React, { createContext, useContext, useEffect, useState } from 'react';
import { connect, disconnect } from '../services/socketService';

const SocketContext = createContext(null);

export function SocketProvider({ userId, onAuthFailure, children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const socketInstance = connect(onAuthFailure);
    setSocket(socketInstance);

    return () => {
      disconnect();
      setSocket(null);
    };
  }, [userId, onAuthFailure]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
