interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'filled';
}

export default function Card({
  children,
  variant = 'default',
  className = '',
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-white border border-gray-200 shadow-sm',
    outline: 'border border-gray-300',
    filled: 'bg-gray-50 border border-gray-100'
  };
  
  return (
    <div
      className={`rounded-xl p-6 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}