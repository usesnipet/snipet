import { toast } from "./use-toast";

type CopyOptions = {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
};
export function useClipboard() {
  return {
    copy: (text: string, opts?: CopyOptions) => {
      navigator.clipboard.writeText(text).then(() => {
        if (opts?.successTitle) {
          toast({
            title: opts.successTitle,
            description: opts.successDescription,
          });
        }
      }).catch(() => {
        if (opts?.errorTitle) {
          toast({
            title: opts.errorTitle,
            description: opts.errorDescription,
          });
        }
      });
    }
  }
}