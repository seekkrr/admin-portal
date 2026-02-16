import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@components/ui";

const STAT_ITEMS = ['Total Users', 'Active Creators', 'Quests Published', 'Total Revenue'];

export function StatsPage() {
    return (
        <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-neutral-900 mb-6">Dashboard & Stats</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {STAT_ITEMS.map((item) => (
                    <Card key={item} padding="sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-neutral-500">{item}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900">0</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Data Export</CardTitle>
                    <CardDescription>Export platform data to CSV.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100 text-center text-neutral-500">
                        Export Tools Placeholder
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
