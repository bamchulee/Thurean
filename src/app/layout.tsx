import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";

export const metadata: Metadata = {
  title: "ทุเรียนวินคิน | คัดสดจากสวน วิ่งส่งตรงถึงบ้าน โทร. 082-282-4238",
  description:
    "ทุเรียนวินคิน คัดสรรทุเรียนแก่จัด 85%+ สดตรงจากสวนระยองและจันทบุรี วิ่งรถส่งตรงถึงบ้านคุณ การันตีคุณภาพเนื้อทุกลูก พบปัญหาเคลมฟรี 100% โทร. 082-282-4238",
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600&family=Prompt:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <CartProvider>
            {children}
            <AuthModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
