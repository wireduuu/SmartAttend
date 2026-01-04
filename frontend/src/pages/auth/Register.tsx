import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import axios from "axios";
import geoImg from "../../images/geoImg.jpg";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = await register(fullName, email, password);

      setSuccess(data.message || "Registration successful!");
      setLoading(false);

      // Redirect to login after a short delay
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Registration failed");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

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
          Admin Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 font-medium">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              className="w-full border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
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
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition"
          >
            {loading ? "Registering..." : "Register"}
          </button>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm text-center">{success}</p>
          )}

          <p className="text-center text-sm mt-2 text-gray-700">
            Already have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Login
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
