import { METRICS_URL } from "../services/api";
import type { HealthState } from "../types/product";

type NodeState = "up" | "down" | "unknown" | "pending";

interface Props {
  state: HealthState;
  lastCheck: Date | null;
}

const NODE_LABEL: Record<NodeState, string> = {
  up: "Operativa",
  down: "Desconectada",
  unknown: "Sin datos",
  pending: "Comprobando",
};

const HEADLINE: Record<HealthState, string> = {
  checking: "Comprobando el sistema…",
  ok: "Todo el sistema está operativo",
  db_down: "La API responde, pero PostgreSQL no está disponible",
  api_down: "No hay conexión con la API",
};

function nodes(state: HealthState): { api: NodeState; db: NodeState } {
  switch (state) {
    case "ok":
      return { api: "up", db: "up" };
    case "db_down":
      return { api: "up", db: "down" };
    case "api_down":
      return { api: "down", db: "unknown" };
    default:
      return { api: "pending", db: "pending" };
  }
}

function Node({ name, role, state }: { name: string; role: string; state: NodeState }) {
  return (
    <div className={`node node--${state}`}>
      <span className="node__dot" aria-hidden="true" />
      <div>
        <p className="node__name">{name}</p>
        <p className="node__role">{role}</p>
      </div>
      <span className="node__state">{NODE_LABEL[state]}</span>
    </div>
  );
}

export default function StatusPanel({ state, lastCheck }: Props) {
  const { api, db } = nodes(state);
  const link: NodeState = api === "up" && db === "up" ? "up" : db === "down" ? "down" : "unknown";

  return (
    <section className={`status status--${state}`} aria-live="polite">
      <div className="status__head">
        <h2>{HEADLINE[state]}</h2>
        <p>
          {lastCheck
            ? `Última comprobación a las ${lastCheck.toLocaleTimeString("es-GT")} · se actualiza cada 5 s`
            : "Consultando /health…"}
        </p>
      </div>

      <div className="status__map">
        <Node name="API FastAPI" role="/health" state={api} />
        <div className={`link link--${link}`} aria-hidden="true">
          <span />
        </div>
        <Node name="PostgreSQL" role="Base de datos" state={db} />
      </div>

      <a className="status__metrics" href={METRICS_URL} target="_blank" rel="noreferrer">
        Ver métricas
      </a>
    </section>
  );
}
