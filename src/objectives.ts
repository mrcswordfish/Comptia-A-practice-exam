import { OBJECTIVES as GENERATED } from "./objectives.generated";

export type CoreId = "220-1201" | "220-1202";

export type ObjectiveMeta = {
  domain: string | null;
  title: string;
  bullets: string[];
};

export const OBJECTIVES: Record<CoreId, Record<string, ObjectiveMeta>> =
  GENERATED as unknown as Record<CoreId, Record<string, ObjectiveMeta>>;

export function getObjectiveMeta(core: CoreId, objectiveId: string): ObjectiveMeta | null {
  return OBJECTIVES[core]?.[objectiveId] ?? null;
}

export function listObjectiveIds(core: CoreId): string[] {
  return Object.keys(OBJECTIVES[core] ?? {});
}

export function objectiveDomainNumber(objectiveId: string): string {
  const dom = objectiveId.split(".")[0];
  return `${dom}.0`;
}

export function listObjectivesByDomain(core: CoreId, domainNumber: string): string[] {
  return listObjectiveIds(core).filter((id) => objectiveDomainNumber(id) === domainNumber);
}
