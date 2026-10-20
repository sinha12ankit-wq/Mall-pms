'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="card stack">
      <h1>Sign in</h1>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          key={state.email}
          required
        />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
