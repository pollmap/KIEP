import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIEP - Korea Industrial Ecosystem Platform",
  description:
    "시군구 단위 산업 생태계 건강도를 지도 위에 시각화하는 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
