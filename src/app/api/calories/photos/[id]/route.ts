import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { foodProducts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response(null, { status: 404 });
  const row = await db
    .select({ photo: foodProducts.photo })
    .from(foodProducts)
    .where(and(eq(foodProducts.id, id), eq(foodProducts.userId, user.id)))
    .get();
  if (!row?.photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(row.photo.split(",")[1], "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
