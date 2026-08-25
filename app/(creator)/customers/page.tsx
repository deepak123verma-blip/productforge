import { CreatorShell } from "../../../components/creator/CreatorShell";
import { Money } from "../../../components/primitives/Money";
import { Table } from "../../../components/primitives/Table";
import { getRepository } from "../../../lib/db/repositories";
import { requireCreator } from "../../../lib/auth/require";

export default async function CustomersPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const customers = await repo.listCustomers(me.id);

  return (
    <CreatorShell title="Customers" displayName={me.displayName}>
      <Table caption="Customers" headers={["Email", "First purchase", "Purchases", "Lifetime value", "Owns"]}>
        {customers.map((c) => (
          <tr key={c.emailMasked} className="border-b border-hairline">
            <td className="whitespace-nowrap px-tight py-tight font-medium text-ink">{c.emailMasked}</td>
            <td className="whitespace-nowrap px-tight py-tight">{c.firstPurchaseLabel}</td>
            <td className="px-tight py-tight">{c.purchases}</td>
            <td className="px-tight py-tight"><Money cents={c.lifetimeValueCents} /></td>
            <td className="px-tight py-tight">{c.productsOwned.join(" · ")}</td>
          </tr>
        ))}
      </Table>
    </CreatorShell>
  );
}
