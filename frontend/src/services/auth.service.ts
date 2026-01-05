import axios from "axios";
import api from "./api";

/* =======================
   TYPES
======================= */
interface LoginPayload {
  email: string;
  password: string;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  access_exp: number; // timestamp in seconds
  user: User;
}

interface RefreshResponse {
  access_token: string;
  expires_at: number; // timestamp in ms
}

interface RegisterResponse {
  message: string;
}

/* =======================
   AUTH REQUESTS
======================= */

// Login
export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>(
    "/login",
    payload,
    { baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000" }
  );

  return res.data;
};

// Register
export const register = async (payload: {
  full_name: string;
  email: string;
  password: string;
}): Promise<RegisterResponse> => {
  const res = await api.post<RegisterResponse>(
    "/register",
    payload,
    { baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000" }
  );

  return res.data;
};

// Logout
export const logout = async (): Promise<void> => {
  await api.post(
    "/logout",
    null,
    { baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000" }
  );
};

/* =======================
   SESSION MANAGEMENT
======================= */

// Get current user profile
export const getProfile = async (): Promise<User> => {
  const res = await api.get<User>("/profile");
  return res.data;
};


// Refresh access token
export const refreshToken = async (): Promise<RefreshResponse> => {
  const storage =
    localStorage.getItem("refresh_token") ? localStorage : sessionStorage;

  const refresh_token = storage.getItem("refresh_token");
  if (!refresh_token) throw new Error("No refresh token");

  // Make a request WITHOUT Axios interceptors messing with headers
  const res = await axios.post<RefreshResponse>(
    `${import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"}/refresh`,
    {}, // empty body
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refresh_token}`, // <-- only refresh token
      },
    }
  );

  return res.data;
};
