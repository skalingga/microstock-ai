import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Email belum diisi.").email("Format email tidak valid."),
  password: z.string().min(1, "Password belum diisi.").min(8, "Password minimal 8 karakter."),
});

export const emailSchema = credentialsSchema.pick({ email: true });

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password minimal 8 karakter."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Konfirmasi password tidak sama.", path: ["confirm"] });
