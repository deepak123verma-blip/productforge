import { CreatorShell } from "../../../components/creator/CreatorShell";
import { SalesTable } from "../../../components/creator/SalesTable";
import { getRepository } from "../../../lib/db/repositories";
import { requireCreator } from "../../../lib/auth/require";

export default async function SalesPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const orders = await repo.listOrders(me.id);
  return (
    <CreatorShell title="Sales" displayName={me.displayName}>
      <SalesTable orders={orders} />
    </CreatorShell>
  );
}
