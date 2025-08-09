export type Placeholder = unknown;

export interface WeightedItem {
  weight: number;
  [key: string]: unknown;
}

export interface RNG {
  next(): number;
  float(): number;
  int(min: number, max: number): number;
  pickWeighted<T extends WeightedItem>(list: T[]): T | undefined;
}
