import { Star } from "lucide-react";
import { cx } from "@/utils/cx";

/** 1–5 star rating, read-only. */
export function ReviewStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
    const cls = size === "md" ? "h-5 w-5" : "h-4 w-4";
    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={cx(cls, i <= rating ? "fill-highlight text-highlight" : "text-line-strong")} aria-hidden />
            ))}
        </span>
    );
}
