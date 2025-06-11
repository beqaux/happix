import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Pozitif Etkileşim Arşivi
        </h1>
        
        <p className="max-w-prose text-lg text-muted-foreground sm:text-xl">
          X'teki olumlu anılarınızı saklayın, organize edin ve istediğiniz zaman yeniden keşfedin.
          Beğendiğiniz, ilham aldığınız ve sizi mutlu eden paylaşımlar artık kaybolmayacak.
        </p>

        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/login">
              X ile Giriş Yap
            </Link>
          </Button>
          
          <Button variant="outline" asChild size="lg">
            <Link href="/about">
              Daha Fazla Bilgi
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Güvenli Giriş</h3>
            <p className="text-sm text-muted-foreground">
              X hesabınızla güvenli bir şekilde giriş yapın. Verileriniz her zaman sizin kontrolünüzde.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Otomatik Arşivleme</h3>
            <p className="text-sm text-muted-foreground">
              Beğendiğiniz paylaşımlar otomatik olarak arşivlenir. Manuel işlem gerektirmez.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold">Kolay Erişim</h3>
            <p className="text-sm text-muted-foreground">
              Arşivinize istediğiniz zaman, istediğiniz yerden erişin ve pozitif anılarınızı yeniden yaşayın.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
