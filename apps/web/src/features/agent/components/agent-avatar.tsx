import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BotIcon, ImageUpIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { useFormContext } from "react-hook-form";
import stc from "string-to-color";

const AVATAR_SIZE = 256;

type AgentAvatarProps = {
  avatar?: string | null;
  /** Gives the fallback a color of its own, to tell agents without an avatar apart. */
  name?: string;
  className?: string;
  onClick?: () => void;
};
export function AgentAvatar({ avatar, name, className, onClick }: AgentAvatarProps) {
  return (
    <Avatar className={cn("size-9 rounded-lg after:rounded-lg", className)} onClick={onClick}>
      {avatar && <AvatarImage src={avatar} alt="" className="rounded-lg" />}
      <AvatarFallback
        className={cn("rounded-lg", name && "text-white")}
        style={name ? { backgroundColor: stc(name) } : undefined}
      >
        <BotIcon className="size-1/2" />
      </AvatarFallback>
    </Avatar>
  );
}

/** Center-crops the image to a square and shrinks it to a small data URL. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
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
          <FormItem className="w-24 shrink-0">
            <FormLabel>Avatar</FormLabel>
            <AgentAvatar avatar={field.value} className="size-24" onClick={() => inputRef.current?.click()} />
            <FormControl>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
            </FormControl>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-0 flex-1"
                onClick={() => inputRef.current?.click()}
              >
                {!field.value && <ImageUpIcon />}
                {field.value ? "Change" : "Upload"}
              </Button>
              {field.value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove avatar"
                  onClick={() => field.onChange(null)}
                >
                  <XIcon />
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
