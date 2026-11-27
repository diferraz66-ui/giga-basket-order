<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Catalog products live in `public.products` and are managed in the internal admin; `src/data/catalog.ts` keeps categories and a bundled fallback for an instant first render. Uploaded photos use the private `product-images` bucket with signed URLs.
- Customers log in with WhatsApp + password: the WhatsApp is normalized (`src/lib/phone.ts`) and mapped to an internal login email; auto-confirm is on because that address cannot receive mail, so email password reset does not work.
- Customer profile (name, WhatsApp, marketing opt-in with timestamp) is created by the `handle_new_user` trigger from signup metadata; the opt-in must default to false (LGPD).
- Orders are stored in `public.orders` with an identity `order_number` displayed as `#000001`; the WhatsApp message is built by `buildOrderMessage` in `src/lib/order.ts` — keep its tests in sync.
- Payment proofs are analyzed server-side in `src/lib/orders.functions.ts` and kept in the private `payment-proofs` bucket; order item edits, cancellation, and finalization use protected database functions so totals and proof requirements cannot be bypassed by the browser.
- The catalog and cart are public; customer signup/login appears only during checkout. Product reads and temporary image URLs are public, while orders and all mutations remain protected.
- Seller submissions reuse the unitary admin product form; RLS enforces pending-only inserts and owner-prefixed photo uploads so browser changes cannot bypass approval.
- Public photo signing reads only approved products; pending photo signing uses authenticated row visibility so unpublished photos remain private.
- Product image gestures use react-zoom-pan-pinch in a dedicated component remounted for each dialog opening to reset the transform and keep controls synchronized.
- Store settings use a singleton row in `public.configuracoes_loja`, with public reads and active-admin-only writes; product gallery paths use a database-constrained text array, and product Realtime retains existing RLS.
- New-order minimum validation sums validated item quantities against the singleton store setting (schema default when absent), not a monetary threshold; this keeps database enforcement aligned with configurable unit counts.
- Customer signup and WhatsApp password reset run as server functions in `src/lib/customer-auth.functions.ts` (not Edge Functions, per stack rules); they reuse `whatsappToLoginEmail` so existing customer logins keep working.
