import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRoutine } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { RoutineEditor } from "@/components/routine-editor";
import { monthKeyOf } from "@/lib/month-calendar";

const monthFormatter = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** This month plus the next two — the horizon worth planning ahead. */
function upcomingMonths(today: Date) {
  return [0, 1, 2].map((offset) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1),
    );
    const label = monthFormatter.format(date);
    return {
      key: monthKeyOf(date),
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  });
}

export default async function RoutinePage() {
  const user = await requireUser();
  const routine = await getRoutine(user.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Rotina semanal"
        subtitle="O que treinas em cada dia da semana"
        action={
          <Link href="/workouts" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      <RoutineEditor
        initialRoutine={routine}
        months={upcomingMonths(new Date())}
      />
    </div>
  );
}
