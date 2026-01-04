type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
      {...props}
    />
  );
}
