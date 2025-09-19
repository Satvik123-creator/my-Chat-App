import { createContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
axios.defaults.baseURL = backendUrl;
console.log("Axios baseURL:", axios.defaults.baseURL);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  //check if user is authenticated and if so set the user data and connect the socket
  const checkAuth = async () => {
    try {
      const { data } = await axios.get("api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //login function to handle user authentication and scoket connection
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
        axios.defaults.headers.common["token"] = data.token;
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //logout function to handle user logout and socket disconnection
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    axios.defaults.headers.common["token"] = null;
    toast.success("Logged out successfully");
    socket?.disconnect();
  };

  //Upadate profile function to handle user profile upadates
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update_profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //connect socket function to handle socket connection and online users updates
  const connectSocket = (userData) => {
    if (!userData || socket?.connected) return;
    const newSocket = io(backendUrl, {
      query: { userId: userData._id },
      // transports: ["websocket"], // uncomment to force websocket transport
    });
    newSocket.connect();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected", newSocket.id, "for user", userData._id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connect_error:", err);
    });

    const handleOnlineUsers = (userIds) => {
      console.log("Received getOnlineUsers:", userIds);
      setOnlineUsers(userIds);
    };

    newSocket.on("getOnlineUsers", handleOnlineUsers);

    // cleanup in case connectSocket is called again
    newSocket.offCleanup = () => {
      newSocket.off("getOnlineUsers", handleOnlineUsers);
      newSocket.off("connect");
      newSocket.off("connect_error");
    };
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["token"] = token;
    }
    checkAuth();
  }, []);

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
