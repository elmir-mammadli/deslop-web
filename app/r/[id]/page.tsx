import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Report from "@/components/Report";
import { scoreSite } from "@/lib/score";
import { loadReport } from "@/lib/store";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) return { title: "Report not found" };
  const score = scoreSite(report.pages).overall;
  return {
    title: `${report.site} scored ${score}`,
    description: `A Deslop audit of ${report.site}: ${score} out of 100 across ${report.pages.length} pages.`,
    robots: { index: false },
  };
}

export default async function SavedReportPage({ params }: Props) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) notFound();
  return <Report view={report} savedId={report.id} />;
}
