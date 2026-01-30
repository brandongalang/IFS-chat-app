import {
  getPartByIdServer as getPartById,
  getPartRelationshipsServer as getPartRelationships,
  getPartNotesServer as getPartNotes,
} from '@/lib/data/parts';
import { createClient } from '@/lib/supabase/server';
import { resolveUserId } from '@/config/dev';
import type { PartRowV2, PartNoteRowV2, PartRelationshipWithDetails } from '@/lib/data/parts';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer } from '@/components/common/PageContainer';
import { ArrowLeft } from 'lucide-react';
import { EditPartDetails } from '@/components/garden/EditPartDetails';
import { PartSidebarActions } from '@/components/garden/PartSidebarActions';
import { getStatusStyle } from '@/lib/garden/status-styles';
import { cn } from '@/lib/utils';

interface PartDetailPageProps {
  params: Promise<{
    partId: string;
  }>;
}

function InfoList({ title, items }: { title: string; items?: string[] | null }) {
  if (!items || items.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">None recorded yet.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <Badge key={index} variant="secondary" className="text-sm">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function StorySection({ title, content }: { title: string; content?: string | null }) {
  if (!content) return null;
  return (
    <div>
      <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

export default async function PartDetailPage({ params }: PartDetailPageProps) {
  const { partId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = resolveUserId(user?.id);
  const deps = { userId, client: supabase };

  const [partResult, relationshipsResult, notesResult] = await Promise.all([
    getPartById({ partId }, deps),
    getPartRelationships({ partId, includePartDetails: true, limit: 20 }, deps),
    getPartNotes({ partId }, deps),
  ]);

  if (!partResult) {
    return (
      <PageContainer className="py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Part Not Found</h1>
          <p className="text-red-500">The requested part could not be found.</p>
          <Button asChild variant="outline">
            <Link href="/garden">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Garden
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const part: PartRowV2 = partResult;
  const partData = (part.data as any) || {};
  const visualization = partData.visualization as { emoji?: string; color?: string };
  const story = partData.story as { origin?: string; currentState?: string; purpose?: string };
  const statusStyle = getStatusStyle(part.status);
  const headerEmoji = visualization?.emoji ?? '🤗';

  const relationships: PartRelationshipWithDetails[] =
    relationshipsResult && Array.isArray(relationshipsResult)
      ? (relationshipsResult as PartRelationshipWithDetails[])
      : [];
  const notes: PartNoteRowV2[] = notesResult ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <PageContainer className="flex-1 py-6 md:py-8">
        {/* Header */}
        <header className="mb-10 space-y-6">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2">
              <Link href="/garden">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Garden
              </Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-border/40">
            <div className="text-7xl md:text-8xl">{headerEmoji}</div>
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{part.name}</h1>
                <EditPartDetails part={part} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="capitalize text-base" variant="default">
                  {part.category}
                </Badge>
                <Badge
                  className={cn(
                    'capitalize text-base',
                    statusStyle.accentColor.replace('text-', 'bg-').replace('-300', '-500/20')
                  )}
                >
                  {part.status}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <main className="md:col-span-2 space-y-6">
            {/* Story Card */}
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-xl">Story & Purpose</CardTitle>
                <CardDescription>The narrative and role of this part.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StorySection title="Role / Purpose" content={partData.role ?? story?.purpose} />
                <StorySection title="Current State" content={story?.currentState} />
                <StorySection title="Origin Story" content={story?.origin} />
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-xl">Characteristics</CardTitle>
                <CardDescription>The typical triggers, emotions, and beliefs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <InfoList title="Triggers" items={partData.triggers} />
                <InfoList title="Emotions" items={partData.emotions} />
                <InfoList title="Beliefs" items={partData.beliefs} />
              </CardContent>
            </Card>

            {/* Clarification Notes Card */}
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-xl">Clarification Notes</CardTitle>
                <CardDescription>
                  Short reflections and context you&apos;ve saved for this part.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notes.length > 0 ? (
                  <ul className="space-y-3">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-lg border border-border/40 p-3 bg-card/20"
                      >
                        <p className="text-sm whitespace-pre-wrap text-foreground">
                          {note.content}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No clarification notes recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </main>

          {/* Sidebar */}
          <aside className="space-y-6 md:col-span-1">
            {/* Relationships Card */}
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Relationships</CardTitle>
              </CardHeader>
              <CardContent>
                {relationships && relationships.length > 0 ? (
                  <ul className="space-y-4">
                    {relationships.map((rel) => (
                      <li key={rel.id} className="text-sm space-y-1">
                        <span className="font-semibold capitalize text-xs text-muted-foreground">
                          {rel.type}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {rel.parts
                            .filter((p) => p.id !== part.id)
                            .map((p) => (
                              <Button
                                asChild
                                variant="secondary"
                                size="sm"
                                className="text-xs"
                                key={p.id}
                              >
                                <Link href={`/garden/${p.id}`}>{p.name ?? 'View part'}</Link>
                              </Button>
                            ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No relationships recorded yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Actions Card */}
            <PartSidebarActions part={part} />
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
