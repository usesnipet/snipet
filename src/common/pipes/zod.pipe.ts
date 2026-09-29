import { BadRequestException, PipeTransform } from "@nestjs/common";
import z from "zod";

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "validation failed",
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
