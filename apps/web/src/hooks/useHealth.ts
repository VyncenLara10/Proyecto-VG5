import { useEffect, useState } from "react";
import { getHealth } from "../services/api";
import type { HealthState } from "../types/product";

export function useHealth(intervalMs = 5000) {
  const [state, setState] = useState<HealthState>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const result = await getHealth();
      if (!alive) return;
      setState(result);
      setLastCheck(new Date());
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { state, lastCheck };
}
