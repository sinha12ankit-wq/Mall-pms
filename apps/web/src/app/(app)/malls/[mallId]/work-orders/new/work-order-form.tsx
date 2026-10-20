'use client';

import { SLA_HOURS, WORK_ORDER_PRIORITIES } from '@mall-pms/shared';
import { useActionState } from 'react';
import { createWorkOrder, type FormState } from '../actions';

const TRADES = [
  'HVAC',
  'Electrical',
  'Plumbing and STP',
  'Vertical transport',
  'Fire',
  'ELV and security',
  'Housekeeping',
  'Civil and carpentry',
];

export function WorkOrderForm({ mallId }: { mallId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createWorkOrder.bind(null, mallId),
    {},
  );
  const v = state.values ?? {};
  return (
    // Remount after a failed submit so the inputs pick up the submitted values again.
    <form action={action} className="stack form" key={JSON.stringify(v)}>
      <label>
        Title
        <input
          name="title"
          defaultValue={v.title}
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. Escalator stopped near food court"
        />
      </label>
      <div className="form-row">
        <label>
          Type
          <select name="type" defaultValue={v.type ?? 'reactive'}>
            <option value="reactive">Reactive (breakdown)</option>
            <option value="tenant_request">Tenant request</option>
          </select>
        </label>
        <label>
          Trade
          <select name="trade" defaultValue={v.trade ?? 'HVAC'}>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Priority
          <select name="priority" defaultValue={v.priority ?? 'medium'}>
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0]!.toUpperCase() + p.slice(1)} (fix within {SLA_HOURS[p]}h)
              </option>
            ))}
          </select>
        </label>
        <label>
          Reported via
          <select name="source" defaultValue={v.source ?? 'help_desk'}>
            <option value="help_desk">Help desk</option>
            <option value="tenant_app">Tenant app</option>
            <option value="patrol">Patrol</option>
            <option value="bms_alarm">BMS alarm</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Asset tag (optional)
          <input name="assetCode" defaultValue={v.assetCode} placeholder="e.g. M01-ESC-004" />
        </label>
        <label>
          Unit (needed for tenant requests)
          <input name="unitCode" defaultValue={v.unitCode} placeholder="e.g. M01-G-002" />
        </label>
      </div>
      <label>
        Details (optional)
        <textarea name="description" defaultValue={v.description} rows={4} maxLength={2000} />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create work order'}
        </button>
      </div>
    </form>
  );
}
