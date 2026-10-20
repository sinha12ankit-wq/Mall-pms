'use client';

import type { WorkOrderStatus } from '@mall-pms/shared';
import { useActionState, useState } from 'react';
import { changeStatus, type FormState } from '../actions';

const ACTION_LABEL: Partial<Record<WorkOrderStatus, string>> = {
  in_progress: 'Start work',
  on_hold: 'Put on hold',
  cancelled: 'Cancel',
};

export function StatusActions({
  mallId,
  id,
  transitions,
}: {
  mallId: string;
  id: string;
  transitions: WorkOrderStatus[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeStatus.bind(null, mallId, id),
    {},
  );
  const [closing, setClosing] = useState(false);

  return (
    <section className="card">
      <h2>Update</h2>
      <form action={action} className="stack form">
        {closing ? (
          <>
            <div className="form-row">
              <label>
                Labour cost (₹)
                <input name="labourCostInr" type="number" min={0} step="1" />
              </label>
              <label>
                Material cost (₹)
                <input name="materialCostInr" type="number" min={0} step="1" />
              </label>
            </div>
            <div className="actions">
              <button type="submit" name="status" value="closed" disabled={pending}>
                Close work order
              </button>
              <button type="button" className="secondary" onClick={() => setClosing(false)}>
                Back
              </button>
            </div>
          </>
        ) : (
          <div className="actions">
            {transitions.includes('closed') && (
              <button type="button" onClick={() => setClosing(true)}>
                Close…
              </button>
            )}
            {transitions
              .filter((t) => t !== 'closed')
              .map((t) => (
                <button
                  key={t}
                  type="submit"
                  name="status"
                  value={t}
                  className="secondary"
                  disabled={pending}
                >
                  {ACTION_LABEL[t] ?? t}
                </button>
              ))}
          </div>
        )}
        {state.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
