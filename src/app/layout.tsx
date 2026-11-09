import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ทุเรียนบ้านสวน | สั่งทุเรียนคัดคุณภาพ ส่งตรงถึงบ้าน",
  description:
    "สั่งทุเรียนสดคัดคุณภาพจากสวนชั้นดี หมอนทอง ก้านยาว ชะนี พวงมณี ส่งตรงถึงบ้านทั่วไทย",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
