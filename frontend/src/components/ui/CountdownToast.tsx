import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function SessionWarning() {
  const { extendSession } = useAuth();
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const show = () => setSeconds(10);
    window.addEventListener("session-warning", show);

    return () => window.removeEventListener("session-warning", show);
  }, []);

  useEffect(() => {
    const hide = () => setSeconds(0);
    window.addEventListener("session-extended", hide);
    return () => window.removeEventListener("session-extended", hide);
  }, []);

  useEffect(() => {
  if (seconds <= 0) return;
  const i = setInterval(() => {
    setSeconds((s) => {
      console.log("⏱ Session countdown:", s);
      return s - 1;
    });
  }, 1000);
  return () => clearInterval(i);
}, [seconds]);


  if (seconds <= 0) return null;

  return (
    <div className="fixed bottom-4 right-4 card w-80">
      <p className="text-sm">
        Session expires in{" "}
        <b>
          {Math.floor(seconds / 60)}:{seconds % 60}
        </b>
      </p>
      <button onClick={extendSession} className="btn-primary mt-3 w-full">
        Extend Session
      </button>
    </div>
  );
}
