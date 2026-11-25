export type ComoAApiEnvia<T> = T extends string
  ? `${T}`
  : T extends readonly (infer Item)[]
    ? readonly ComoAApiEnvia<Item>[]
    : T extends object
      ? { [Campo in keyof T]: ComoAApiEnvia<T[Campo]> }
      : T;
