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
        bg-white rounded-xl border border-neutral-200
        ${paddingStyles[padding]}
        ${shadowStyles[shadow]}
        ${hover ? "transition-shadow duration-200 hover:shadow-lg" : ""}
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
