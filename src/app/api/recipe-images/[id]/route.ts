import { authorizedClient } from "@/lib/supabase";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizedClient();
  if (!auth)
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  const { id } = await params;
  if (!/^[a-z0-9-]{1,100}$/.test(id))
    return new Response(null, { status: 404 });
  const { data, error } = await auth.db
    .from("recipe_assets")
    .select("mime,data")
    .eq("id", id)
    .single();
  if (error || !data)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  return new Response(Buffer.from(data.data, "base64"), {
    headers: {
      "Content-Type": data.mime,
      "Cache-Control": "private, max-age=300",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
