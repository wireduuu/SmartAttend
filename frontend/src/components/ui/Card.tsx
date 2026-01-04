type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 ${className}`}
    >
      {children}
    </div>
  );
}
