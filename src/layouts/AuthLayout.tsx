import { Outlet } from "react-router-dom";

export function AuthLayout() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-4 font-sans">
            {/* Logo Section */}
            <div className="mb-8 text-center">
                <img
                    src="/seekkrr-logo.svg"
                    alt="SeekKrr"
                    className="h-12 mx-auto"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerText = 'SeekKrr';
                        e.currentTarget.parentElement!.className = 'mb-8 text-4xl font-bold text-teal-900 font-serif';
                    }}
                />
            </div>

            {/* Main Content (Card from LoginPage) */}
            <div className="w-full max-w-5xl animate-fade-in">
                <Outlet />
            </div>
        </div>
    );
}
