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

  if (isAuthenticated) return null;

  return (
    <div
      className="min-h-screen flex justify-end items-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url(${geoImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/10" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg mr-[5%] animate-slideIn">
        <div className="card min-h-[500px] flex flex-col justify-center p-10">
          <h2 className="text-2xl font-semibold text-center mb-6">
            GeoPresence Login
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block mb-1 text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="geopresence@example.com"
                className="input"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block mb-1 text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex justify-between items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => {
                    setRemember(e.target.checked);
                    localStorage.setItem(
                      "rememberMe",
                      String(e.target.checked)
                    );
                  }}
                />
                Remember me
              </label>

              <span className="text-primary cursor-pointer hover:underline">
                Forgot password?
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 justify-center"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            {/* Error */}
            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            {/* Register */}
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <span
                className="text-primary cursor-pointer hover:underline"
                onClick={() => navigate("/register")}
              >
                Register
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
