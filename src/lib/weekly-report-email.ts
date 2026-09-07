import "server-only";
import {
  getWeeklyReportData,
  previousLisbonWeekRange,
} from "./queries";
import { calculateWeeklyReport } from "./weekly-report";
import { fmtDate } from "./format";

/** Builds the weekly summary email body for one account (no-op empty weeks). */
export async function buildWeeklyReportEmail(
  userId: number,
  name: string,
): Promise<{ subject: string; text: string } | null> {
  const { from, to } = previousLisbonWeekRange();
  const report = calculateWeeklyReport(
    await getWeeklyReportData(userId, from, to),
  );
  if (report.workouts === 0 && report.kcalRecordedDays === 0) return null;

  const fromLabel = fmtDate(from);
  const toLabel = fmtDate(new Date(to.getTime() - 24 * 60 * 60 * 1000));
  const lines = [
    `Olá ${name}, o teu resumo de ${fromLabel} a ${toLabel}:`,
    "",
    `- Treinos: ${report.workouts} (${report.sets} séries, ${report.volume.toLocaleString()} kg de volume)`,
    report.kcalRecordedDays > 0
      ? `- Calorias: média ${report.kcalAvg} kcal/dia em ${report.kcalRecordedDays} dia(s) com registo`
      : "- Calorias: sem registos na semana",
    `- Dias na meta: ${report.daysWithinGoal} (de ${report.daysCompleted} concluídos)`,
  ];
  if (report.prs.length > 0) {
    lines.push("", "Recordes batidos:");
    for (const pr of report.prs) lines.push(`- ${pr.exercise}: ${pr.detail}`);
  }
  if (report.weightChange != null) {
    lines.push(
      "",
      `Peso: ${report.weightChange > 0 ? "+" : ""}${report.weightChange} kg na semana`,
    );
  }
  lines.push(
    "",
    "Abre a app para ver o relatório completo: /relatorios",
  );
  return {
    subject: `O teu resumo semanal — Gym Tracker`,
    text: lines.join("\n"),
  };
}
