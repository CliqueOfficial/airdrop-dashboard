import { type AppConf, type Deployment } from "../../types";

interface DeploymentProps {
  deployment: AppConf['deployments'];
}

export default function Deployment(props: DeploymentProps) {
  return (
    <div>
      <h1>Deployment</h1>
    </div>
  );
}