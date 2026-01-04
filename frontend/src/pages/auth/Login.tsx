import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import geoImg from "../../images/geoImg.jpg";
import { Eye, EyeOff } from "lucide-react";

type LocationState = { from?: { pathname: string } };

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as LocationState | null)?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(
    localStorage.getItem("rememberMe") === "true"
  );

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password, remember);

      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Login failed");
      else setError("Login failed");
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex justify-end items-center p-4 relative overflow-hidden font-inter"
      style={{
        backgroundImage: `url(${geoImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/10" />

      <div className="relative z-10 w-full max-w-lg bg-white/95 rounded-xl shadow-2xl p-10 min-h-[500px] flex flex-col justify-center animate-slideIn mr-[5%]">
        <h2 className="text-2xl font-semibold text-center mb-6">
          GeoPresence Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eg: geopresence@example.com"
              className="w-full border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full border rounded-md px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <div className="flex justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  localStorage.setItem("rememberMe", String(e.target.checked));
                }}
              />
              Remember Me
            </label>
            <span className="text-blue-600 cursor-pointer">
              Forgot password?
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <p className="text-center text-sm mt-2 text-gray-700">
            Don&apos;t have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer"
              onClick={() => navigate("/register")}
            >
              Register
            </span>
          </p>
        </form>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-slideIn { animation: slideIn 0.6s ease forwards; }
        `}
      </style>
    </div>
  );
}
