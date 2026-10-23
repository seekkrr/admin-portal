import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { buttonClass, SIZES, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows a spinner and disables the button. */
    loading?: boolean;
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    block?: boolean;
    children?: ReactNode;
}

/** The one button: primary / secondary / ghost / danger × sm / md. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "secondary", size = "md", loading, icon: Icon, iconRight: IconRight, block, className, children, type = "button", disabled, ...rest },
    ref
) {
    const iconCls = SIZES[size].icon;
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={buttonClass(variant, size, { block, className })}
            {...rest}
        >
            {loading ? <Loader2 className={cx(iconCls, "animate-spin")} aria-hidden /> : Icon && <Icon className={iconCls} aria-hidden />}
            {children}
            {IconRight && !loading && <IconRight className={iconCls} aria-hidden />}
        </button>
    );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    icon: LucideIcon;
    /** Required: read by screen readers and shown as a tooltip. */
    label: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
}

/** Square icon-only button with an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { icon: Icon, label, variant = "ghost", size = "md", loading, className, type = "button", disabled, title, ...rest },
    ref
) {
    const iconCls = SIZES[size].icon;
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={title ?? label}
            disabled={disabled || loading}
            className={buttonClass(variant, size, { iconOnly: true, className: cx("px-0", className) })}
            {...rest}
        >
            {loading ? <Loader2 className={cx(iconCls, "animate-spin")} aria-hidden /> : <Icon className={iconCls} aria-hidden />}
        </button>
    );
});

export interface ButtonLinkProps extends LinkProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: LucideIcon;
    block?: boolean;
}

/** A router link styled as a button. */
export function ButtonLink({ variant = "secondary", size = "md", icon: Icon, block, className, children, ...rest }: ButtonLinkProps) {
    return (
        <Link className={buttonClass(variant, size, { block, className: typeof className === "string" ? className : undefined })} {...rest}>
            {Icon && <Icon className={SIZES[size].icon} aria-hidden />}
            {children}
        </Link>
    );
}
