import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog, getWorkoutTemplates } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { TemplateForm } from "@/components/template-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteTemplate } from "./actions";

export default async function TemplatesPage() {
  const user = await requireUser();
  const [templates, catalog] = await Promise.all([
    getWorkoutTemplates(user.id),
    getExerciseCatalog(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Modelos de treino"
        subtitle="Rotinas reutilizáveis para começares mais depressa"
        action={
          <Link href="/workouts/new" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="Ainda não tens modelos"
          hint="Cria um modelo com os exercícios do teu treino de pernas, costas, etc., e usa-o sempre que quiseres começar mais depressa."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div key={t.id} className="card">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/workouts/new?template=${t.id}`}
                    className="btn-ghost h-8 px-3 text-xs"
                  >
                    Usar
                  </Link>
                  <DeleteButton
                    action={deleteTemplate}
                    id={t.id}
                    confirmText="Eliminar este modelo?"
                  />
                </div>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t.exercises.map((e) => e.name).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <TemplateForm
        exercises={catalog.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  );
}
