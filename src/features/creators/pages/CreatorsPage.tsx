import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@components/ui";

export function CreatorsPage() {
    return (
        <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Creators Management</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Creator Directory</CardTitle>
                        <CardDescription>Manage creator accounts and verification status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100 text-center text-neutral-500">
                            Creators List Placeholder
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
