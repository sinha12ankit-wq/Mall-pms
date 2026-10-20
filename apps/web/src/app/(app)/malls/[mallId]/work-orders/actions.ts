'use server';

import type { WorkOrderDetail } from '@mall-pms/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend } from '@/lib/api';

export interface FormState {
  error?: string;
  /** What was submitted, so the form can refill itself after React resets it. */
  values?: Record<string, string>;
}

const formValues = (form: FormData) =>
  Object.fromEntries(
    [...form.entries()].filter(([k, v]) => typeof v === 'string' && !k.startsWith('$')) as [
      string,
      string,
    ][],
  );

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};

export async function createWorkOrder(
  mallId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const result = await apiSend<WorkOrderDetail>('POST', `/malls/${mallId}/work-orders`, {
    type: text(form, 'type'),
    trade: text(form, 'trade'),
    title: text(form, 'title'),
    description: text(form, 'description'),
    priority: text(form, 'priority'),
    source: text(form, 'source'),
    assetCode: text(form, 'assetCode'),
    unitCode: text(form, 'unitCode'),
  });
  if (!result.ok) return { error: result.error, values: formValues(form) };
  redirect(`/malls/${mallId}/work-orders/${result.data.id}`);
}

export async function changeStatus(
  mallId: string,
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const num = (key: string) =>
    text(form, key) === undefined ? undefined : Number(text(form, key));
  const result = await apiSend<WorkOrderDetail>(
    'PATCH',
    `/malls/${mallId}/work-orders/${id}/status`,
    {
      status: text(form, 'status'),
      labourCostInr: num('labourCostInr'),
      materialCostInr: num('materialCostInr'),
    },
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/malls/${mallId}/work-orders/${id}`);
  return {};
}
