import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@components/ui";

export function UsersPage() {
    return (
        <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Users Management</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>User Directory</CardTitle>
                        <CardDescription>View and manage all registered users.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100 text-center text-neutral-500">
                            Users List Placeholder
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
