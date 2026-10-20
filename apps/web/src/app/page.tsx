import type { MeResponse } from '@mall-pms/shared';
import { apiGet } from '@/lib/api';
import { logout } from './actions';

interface Mall {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
}

const roleLabel = (role: string) => role.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default async function HomePage() {
  const [me, malls] = await Promise.all([apiGet<MeResponse>('/auth/me'), apiGet<Mall[]>('/malls')]);

  return (
    <main className="page stack">
      <header className="row">
        <div>
          <h1>Malls</h1>
          <p className="muted">
            Signed in as {me.fullName} ({me.email})
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="secondary">
            Sign out
          </button>
        </form>
      </header>

      <section className="card">
        <h2>Your roles</h2>
        <ul>
          {me.roles.map((r) => (
            <li key={`${r.role}-${r.mallId ?? 'all'}`}>
              {roleLabel(r.role)} · {r.mallCode ?? 'All malls'}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Malls you can access</h2>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>City</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {malls.map((m) => (
              <tr key={m.id}>
                <td>{m.code}</td>
                <td>{m.name}</td>
                <td>{m.city}</td>
                <td>{m.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
