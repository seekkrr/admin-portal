import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    padding?: "none" | "sm" | "md" | "lg";
    shadow?: "none" | "sm" | "md" | "lg";
    hover?: boolean;
}

const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
};

const shadowStyles = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
};

export function Card({
    children,
    padding = "md",
    shadow = "sm",
    hover = false,
    className = "",
    ...props
}: CardProps) {
    return (
        <div
            className={`
        bg-white/90 backdrop-blur-sm rounded-xl border border-neutral-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] ring-1 ring-white/50
        ${paddingStyles[padding]}
        ${shadowStyles[shadow]}
        ${hover ? "transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5" : ""}
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`mb-4 ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <h3 className={`text-xl font-semibold text-neutral-900 ${className}`}>
            {children}
        </h3>
    );
}

export function CardDescription({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <p className={`text-sm text-neutral-500 mt-1 ${className}`}>
            {children}
        </p>
    );
}

export function CardContent({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={className}>{children}</div>;
}

export function CardFooter({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`mt-6 pt-4 border-t border-neutral-100 ${className}`}>
            {children}
        </div>
    );
}
