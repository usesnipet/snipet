import { Button } from "@/components/ui/button";
import {
  DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import type { DialogInstanceProps } from "@/lib/dialog";

type SecretKeyDialogProps = DialogInstanceProps<{
  secret: string
  title?: string
  description?: string
}>;

export function SecretKeyDialog({
  secret,
  title = "Secret key created",
  description = "Copy this key now. You will not be able to see it again.",
  close,
}: SecretKeyDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DialogContent className="sm:max-w-md" showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Input readOnly value={secret} className="font-mono text-xs" containerclassname="w-full" />
        <Button type="button" variant="outline" size="icon-lg" onClick={handleCopy}>
          {copied ? <Check /> : <Copy />}
          <span className="sr-only">Copy</span>
        </Button>
      </div>
      <DialogFooter>
        <Button type="button" onClick={close}>
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
