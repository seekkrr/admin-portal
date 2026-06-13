export function Footer() {
    return (
        <footer className="mt-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto border-t border-neutral-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-neutral-400">
                    © {new Date().getFullYear()} SeekKrr. All rights reserved.
                </p>
                <div className="flex items-center gap-4 text-sm text-neutral-400">
                    <a href="https://seekkrr.com/terms" className="hover:text-neutral-600 transition-colors">Privacy Policy</a>
                    <a href="https://seekkrr.com/privacy" className="hover:text-neutral-600 transition-colors">Terms of Service</a>
                </div>
            </div>
        </footer>
    );
}
