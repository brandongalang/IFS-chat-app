'use client';

import { useState, useTransition } from 'react';
import { type PartRowV2 as PartRow } from '@/lib/data/parts';
import { updatePartDetails } from '@/app/garden/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from '@/components/garden/EmojiPicker';
import { Pencil } from 'lucide-react';

interface EditPartDetailsProps {
  part: PartRow;
}

export function EditPartDetails({ part }: EditPartDetailsProps) {
  const { toast } = useToast();
  const [isUpdatePending, startUpdate] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(part.name ?? '');
  const initialEmoji = (part.data?.visualization as { emoji?: string })?.emoji || '🤗';
  const [emoji, setEmoji] = useState(initialEmoji);

  const handleSave = () => {
    startUpdate(async () => {
      const formData = new FormData();
      formData.append('partId', part.id);
      formData.append('name', name ?? '');
      formData.append('emoji', emoji);

      const result = await updatePartDetails(formData);

      if (result.success) {
        toast({
          title: 'Part Updated',
          description: 'Your changes have been saved.',
        });
        setIsOpen(false);
      } else {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : 'Validation failed. Please check your input.';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Part</DialogTitle>
          <DialogDescription>Update the name and emoji for your part.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Emoji</Label>
            <div className="col-span-3">
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isUpdatePending}>
            {isUpdatePending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
