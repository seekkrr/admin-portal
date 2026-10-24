export function Footer() {
    return (
        <footer className="mt-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="max-w-page mx-auto border-t border-line pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-ink-faint">
                <p className="text-sm">
                    © {new Date().getFullYear()} SeekKrr. All rights reserved.
                </p>
                <div className="flex items-center gap-4 text-sm">
                    <a href="https://seekkrr.com/privacy" className="hover:text-ink-muted transition-colors">Privacy Policy</a>
                    <a href="https://seekkrr.com/terms" className="hover:text-ink-muted transition-colors">Terms of Service</a>
                </div>
            </div>
        </footer>
    );
}
