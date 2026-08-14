import type { Metadata } from "next";
import { LegalDocView } from "@/components/legal-doc";
import { privacyVi, privacyEn } from "./copy";

export const metadata: Metadata = {
  title: "Quyền riêng tư",
  description:
    "Atelier lưu dữ liệu nào, lưu ở đâu, và cách bạn xuất lại hoặc xoá dữ liệu học của mình.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalDocView vi={privacyVi} en={privacyEn} />;
}
