import client from "@/lib/api-client";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { toast } from "../use-toast";

export const registerSchema = z.object({
  nickname: z.string()
    .min(3, { message: "Nickname is required" })
    .max(255, { message: "Nickname must be less than 255 characters long" }),
  name: z.string()
    .min(3, { message: "Name is required" })
    .max(255, { message: "Name must be less than 255 characters long" }),
  email: z.email({ message: "Invalid email address" }),
  password: z.string(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
}).strict();

export type RegisterSchema = z.infer<typeof registerSchema>;

export const useRegister = () => {
  return useMutation({
    mutationFn: async (data: RegisterSchema) => {
      const response = await client({
        method: "POST",
        url: "/api/users/create-account",
        data
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Account created",
        description: "Your account has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  })
}