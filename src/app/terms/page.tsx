import type { Metadata } from "next";
import { LegalDocView } from "@/components/legal-doc";
import { termsVi, termsEn } from "./copy";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản sử dụng Atelier, kèm giấy phép của các nguồn từ vựng và hình minh hoạ trong ứng dụng.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalDocView vi={termsVi} en={termsEn} />;
}
