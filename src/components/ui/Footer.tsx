export function Footer() {
    return (
        <footer className="bg-white border-t border-neutral-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <p className="text-sm text-neutral-500 text-center">
                    © {new Date().getFullYear()} SeekKrr. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
