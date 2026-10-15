import z from "zod";

export const dataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Data URL must be a PNG, JPEG or WebP image");
