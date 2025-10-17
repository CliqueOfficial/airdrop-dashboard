import { useParams } from '@solidjs/router';
import { useConfig } from '../hooks/useConfig';

export default function Dashboard() {
  const { config } = useConfig();
  const { appId } = useParams();

  return (
    <div>
      <h1>Dashboard</h1>
    </div>
  );
}
