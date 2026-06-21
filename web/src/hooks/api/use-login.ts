import client from "@/lib/api-client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { toast } from "../use-toast";

export const loginSchema = z.object({
  account: z.string()
    .min(3, { message: "Account is required" })
    .max(255, { message: "Account must be less than 255 characters long" }),
  password: z.string(),
}).strict();

export type LoginSchema = z.infer<typeof loginSchema>;

export const useLogin = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (data: LoginSchema) => {
      const response = await client({
        method: "POST",
        url: "/api/users/login",
        data
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "You are now logged in",
      });
      navigate("/");
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