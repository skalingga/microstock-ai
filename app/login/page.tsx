import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ tautan?: string }> }) {
  const { tautan } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">MicroStock Vector AI</CardTitle>
          <CardDescription>Masuk untuk membuat aset vektor untuk Adobe Stock.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            notice={tautan === "kedaluwarsa" ? "Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru." : undefined}
          />
        </CardContent>
      </Card>
    </main>
  );
}
