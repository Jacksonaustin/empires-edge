export const RESOURCE_KINDS = ["food", "wood", "stone", "gold"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export type Resources = Record<ResourceKind, number>;
export type Cost = Partial<Resources>;

export function canAfford(have: Resources, cost: Cost): boolean {
  return RESOURCE_KINDS.every((k) => have[k] >= (cost[k] ?? 0));
}
