import client from "@/lib/api-client";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

export const loginSchema = z.object({
  account: z.string().min(1, { message: "Account is required" }),
  password: z.string().min(1, { message: "Password is required" }),
})
export type LoginSchema = z.infer<typeof loginSchema>;

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: LoginSchema) => {
      const response = await client({
        method: "POST",
        url: "/api/users/login",
        data
      });
      return response.data;
    },
  })
}