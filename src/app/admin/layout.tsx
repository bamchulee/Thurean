import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ระบบจัดการร้าน | ทุเรียนวินคิน",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
