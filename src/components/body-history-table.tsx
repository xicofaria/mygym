import { Fragment } from "react";
import type { BodyFieldDef, BodyHistoryRow } from "@/lib/body-progress";
import { fmtDate } from "@/lib/format";
import { deltaClasses } from "./body-delta";
import { DeleteButton } from "./delete-button";

/**
 * One row per measurement, one column per measure, with the change against
 * the previous entry that recorded it. Scrolls sideways with the date pinned.
 */
export function BodyHistoryTable({
  rows,
  fields,
  isSelf,
  deleteAction,
}: {
  rows: BodyHistoryRow[];
  fields: readonly BodyFieldDef[];
  isSelf: boolean;
  deleteAction: (id: number) => Promise<unknown>;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/5 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            <th className="sticky left-0 bg-white px-4 py-2.5 text-left font-medium dark:bg-zinc-900">
              Data
            </th>
            {fields.map((field) => (
              <th
                key={field.key}
                className="whitespace-nowrap px-3 py-2.5 text-right font-medium"
              >
                {field.label} ({field.unit})
              </th>
            ))}
            {isSelf && <th className="w-10 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                className={
                  // The note belongs to this row, so the separator waits for it.
                  row.notes
                    ? ""
                    : "border-b border-black/5 last:border-0 dark:border-white/10"
                }
              >
                <th
                  scope="row"
                  className="sticky left-0 whitespace-nowrap bg-white px-4 py-2.5 text-left font-medium dark:bg-zinc-900"
                >
                  {fmtDate(row.date)}
                </th>
                {fields.map((field) => {
                  const cell = row.cells[field.key];
                  return (
                    <td
                      key={field.key}
                      className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums"
                    >
                      {cell ? (
                        <>
                          {cell.value}
                          {cell.delta != null && cell.delta !== 0 && (
                            <span
                              className={`ml-1.5 text-[10px] ${deltaClasses(
                                cell.delta,
                                field.goal,
                              )}`}
                            >
                              {cell.delta > 0 ? "▲" : "▼"}&nbsp;
                              {Math.abs(cell.delta)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
                {isSelf && (
                  <td className="px-2 py-2.5">
                    <DeleteButton
                      action={deleteAction}
                      id={row.id}
                      confirmText="Eliminar esta medição?"
                    />
                  </td>
                )}
              </tr>
              {row.notes && (
                <tr className="border-b border-black/5 last:border-0 dark:border-white/10">
                  <td
                    colSpan={fields.length + (isSelf ? 2 : 1)}
                    className="px-4 pb-2.5 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {row.notes}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
