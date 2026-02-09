import type { Metadata } from "next";
import "./globals.css";
import GlobalNav from "@/components/Nav/GlobalNav";

export const metadata: Metadata = {
  title: "KIEP - Korea Industrial Ecosystem Platform",
  description:
    "전국 250개 시군구의 산업, 인구, 부동산, 고용, 교육, 상권, 교통 데이터를 종합 시각화하는 플랫폼",
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
