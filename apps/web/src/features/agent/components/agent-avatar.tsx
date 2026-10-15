import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BotIcon, ImageUpIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { useFormContext } from "react-hook-form";

const AVATAR_SIZE = 256;

export function AgentAvatar({ avatar, className }: { avatar?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-9 rounded-lg after:rounded-lg", className)}>
      {avatar && <AvatarImage src={avatar} alt="" className="rounded-lg" />}
      <AvatarFallback className="rounded-lg">
        <BotIcon className="size-1/2" />
      </AvatarFallback>
    </Avatar>
  );
}

// Center-crops the image to a square and shrinks it to a small data URL.
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.8);
  // Browsers without a WebP encoder fall back to PNG, which is too heavy.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

export function AgentAvatarField({ name }: { name: string }) {
  const form = useFormContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            field.onChange(await toAvatarDataUrl(file));
          } catch {
            toast({ title: "Could not read this image", variant: "destructive" });
          }
        };

        return (
          <FormItem>
            <FormLabel>Avatar</FormLabel>
            <div className="flex items-center gap-3">
              <AgentAvatar avatar={field.value} className="size-14" />
              <FormControl>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
              </FormControl>
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <ImageUpIcon /> {field.value ? "Change" : "Upload"}
              </Button>
              {field.value && (
                <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(null)}>
                  <XIcon /> Remove
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
