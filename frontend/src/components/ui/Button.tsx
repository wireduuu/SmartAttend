type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "px-4 py-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary: "bg-primary text-white hover:bg-indigo-700 focus:ring-primary",
    secondary:
      "bg-secondary text-white hover:bg-green-600 focus:ring-secondary",
    outline:
      "border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
