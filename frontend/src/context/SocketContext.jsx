import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Helper functions
  const trackOrder = (orderId) => {
    if (socket) {
      socket.emit('track:order', orderId);
    }
  };

  const untrackOrder = (orderId) => {
    if (socket) {
      socket.emit('untrack:order', orderId);
    }
  };

  const trackDriver = (driverId) => {
    if (socket) {
      socket.emit('track:driver', driverId);
    }
  };

  const untrackDriver = (driverId) => {
    if (socket) {
      socket.emit('untrack:driver', driverId);
    }
  };

  const trackRoute = (routeId) => {
    if (socket) {
      socket.emit('track:route', routeId);
    }
  };

  const untrackRoute = (routeId) => {
    if (socket) {
      socket.emit('untrack:route', routeId);
    }
  };

  const updateDriverLocation = (driverId, latitude, longitude, heading, speed) => {
    if (socket) {
      socket.emit('driver:location', { driverId, latitude, longitude, heading, speed });
    }
  };

  const updateOrderStatus = (orderId, status, note, latitude, longitude) => {
    if (socket) {
      socket.emit('order:status', { orderId, status, note, latitude, longitude });
    }
  };

  const value = {
    socket,
    connected,
    trackOrder,
    untrackOrder,
    trackDriver,
    untrackDriver,
    trackRoute,
    untrackRoute,
    updateDriverLocation,
    updateOrderStatus
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
