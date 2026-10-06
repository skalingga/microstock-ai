import { describe, expect, it } from "vitest";
import { emailSchema, newPasswordSchema } from "@/lib/auth/schema";

describe("newPasswordSchema", () => {
  it("accepts a matching password of 8 or more characters", () => {
    expect(newPasswordSchema.safeParse({ password: "abcd1234", confirm: "abcd1234" }).success).toBe(true);
  });

  it("rejects a short password", () => {
    const r = newPasswordSchema.safeParse({ password: "abc", confirm: "abc" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Password minimal 8 karakter.");
  });

  it("rejects a confirmation that differs", () => {
    const r = newPasswordSchema.safeParse({ password: "abcd1234", confirm: "abcd12345" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Konfirmasi password tidak sama.");
  });
});

describe("emailSchema", () => {
  it("trims and validates the email", () => {
    expect(emailSchema.parse({ email: "  a@b.co " }).email).toBe("a@b.co");
    expect(emailSchema.safeParse({ email: "bukan-email" }).success).toBe(false);
  });
});
