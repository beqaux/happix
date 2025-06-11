import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12">
      <Button variant="ghost" asChild className="mb-8">
        <Link href="/" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Ana Sayfa
        </Link>
      </Button>

      <div className="space-y-8">
        <div>
          <h1 className="mb-4 text-3xl font-bold">Pozitif Etkileşim Arşivi Hakkında</h1>
          <p className="text-lg text-muted-foreground">
            Sosyal medya, günümüzde hayatımızın önemli bir parçası. Ancak sürekli akan içerik
            nedeniyle, bizi mutlu eden, ilham veren ve değerli bulduğumuz paylaşımlar
            hızla kayboluyor. İşte tam bu noktada Pozitif Etkileşim Arşivi devreye giriyor.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Neden Bu Projeyi Geliştirdik?</h2>
          <p className="text-muted-foreground">
            X (Twitter) gibi platformlarda her gün milyonlarca paylaşım yapılıyor. Bu yoğun
            akış içinde, beğendiğimiz ve değer verdiğimiz içeriklere daha sonra ulaşmak
            zorlaşıyor. Pozitif Etkileşim Arşivi, bu soruna çözüm olarak tasarlandı.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Nasıl Çalışır?</h2>
          <div className="space-y-2">
            <h3 className="font-medium">1. X ile Güvenli Giriş</h3>
            <p className="text-muted-foreground">
              X hesabınızla güvenli bir şekilde giriş yapın. Verileriniz her zaman sizin
              kontrolünüzde kalır ve sadece izin verdiğiniz ölçüde erişilir.
            </p>

            <h3 className="font-medium">2. Otomatik Arşivleme</h3>
            <p className="text-muted-foreground">
              Beğendiğiniz paylaşımlar otomatik olarak arşivinize eklenir. Ekstra bir işlem
              yapmanıza gerek kalmaz.
            </p>

            <h3 className="font-medium">3. Kolay Erişim</h3>
            <p className="text-muted-foreground">
              Arşivinize istediğiniz zaman, istediğiniz yerden erişin. Paylaşımları
              kategorilere ayırabilir, arayabilir ve filtreleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Gizlilik ve Güvenlik</h2>
          <p className="text-muted-foreground">
            Gizliliğiniz bizim için önemli. Verileriniz güvenli bir şekilde saklanır ve
            sadece sizin izin verdiğiniz ölçüde kullanılır. X hesabınızla ilgili minimum
            düzeyde yetki talep eder ve bu yetkileri sadece gerekli işlemler için kullanırız.
          </p>
        </div>

        <div className="flex justify-center pt-8">
          <Button asChild size="lg">
            <Link href="/login">
              Hemen Başlayın
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 