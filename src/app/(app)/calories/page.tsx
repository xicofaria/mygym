import { requireUser } from "@/lib/auth";
import { getCalorieData } from "@/lib/calorie-queries";
import { lisbonDateKey } from "@/lib/format";
import { isDateKey } from "@/lib/workout-calendar";
import { periodDates } from "@/lib/nutrition";
import { CaloriesTracker } from "@/components/calories-tracker";
export default async function CaloriesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = lisbonDateKey();
  const date =
    isDateKey(params.date) && params.date <= today ? params.date : today;
  const period =
    params.period === "week" || params.period === "month"
      ? params.period
      : "day";
  const dates = periodDates(date, period);
  const data = await getCalorieData(user.id, dates[0], dates.at(-1)!);
  return (
    <CaloriesTracker
      data={data}
      date={date}
      today={today}
      period={period}
      provider={
        process.env.AI_PROVIDER === "openrouter" ? "openrouter" : "openai"
      }
    />
  );
}
