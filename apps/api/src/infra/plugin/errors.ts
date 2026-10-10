import { BadRequestException, NotFoundException } from "@nestjs/common";

export class PluginNotFoundError extends NotFoundException {
  constructor(key: string) {
    super(`plugin "${key}" not found`);
  }
}

// A driver rejected its options once the placeholders were filled in.
export class PluginValidationError extends BadRequestException {}
