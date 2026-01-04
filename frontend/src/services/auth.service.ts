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
  access_exp: number;
  user: User;
}

interface RefreshResponse {
  access_token: string;
  expires_at: number;
}

interface RegisterResponse {
  message: string;
}

/* =======================
   AUTH REQUESTS
======================= */

// Login
export const login = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>("/login", payload, {
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
    withCredentials: true,
  });

  return res.data;
};

// Register
export const register = async (payload: {
  full_name: string;
  email: string;
  password: string;
}): Promise<RegisterResponse> => {
  const res = await api.post<RegisterResponse>("/register", payload, {
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
    withCredentials: true,
  });

  return res.data;
};

// Logout
export const logout = async (): Promise<void> => {
  await api.post(
    "/logout",
    null,
    {
      baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
      withCredentials: true,
    }
  );
};

/* =======================
   SESSION MANAGEMENT
======================= */

// Restore session
export const getProfile = async (): Promise<User> => {
  const res = await api.get<User>("/profile", {
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
    withCredentials: true,
  });

  return res.data;
};

// Extend session
export const refreshToken = async (): Promise<RefreshResponse> => {
  const refreshToken =
    localStorage.getItem("refresh_token") ||
    sessionStorage.getItem("refresh_token");

  if (!refreshToken) {
    throw new Error("No refresh token found");
  }

  const res = await api.post<RefreshResponse>(
    "/refresh",
    null,
    {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
      baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
    }
  );

  return res.data;
};

