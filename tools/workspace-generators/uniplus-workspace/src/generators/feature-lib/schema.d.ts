export type FeatureLibType = 'feature' | 'ui' | 'data-access';

export interface FeatureLibSchema {
  /** Nome da lib no formato `<scope>/<name>`. */
  name: string;
  /** Tipo da lib no eixo `type:*`. */
  type: FeatureLibType;
}
