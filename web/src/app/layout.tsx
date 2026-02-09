import type { Metadata } from "next";
import "./globals.css";
import GlobalNav from "@/components/Nav/GlobalNav";

export const metadata: Metadata = {
  title: "KIEP - Korea Industrial Ecosystem Platform",
  description:
    "전국 250개 시군구의 산업, 인구, 경제, 부동산, 고용, 교육, 상권, 의료/복지, 안전, 환경, 인프라, 교통, 문화관광 등 13개 분야 65개 지표를 종합 시각화하는 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <GlobalNav />
        <main className="pt-[var(--nav-height)]">{children}</main>
      </body>
    </html>
  );
}
