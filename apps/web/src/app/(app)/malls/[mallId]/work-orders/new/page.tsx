import { WorkOrderForm } from './work-order-form';

export default async function NewWorkOrderPage({
  params,
}: PageProps<'/malls/[mallId]/work-orders/new'>) {
  const { mallId } = await params;
  return (
    <section className="card narrow">
      <h2>New work order</h2>
      <WorkOrderForm mallId={mallId} />
    </section>
  );
}
