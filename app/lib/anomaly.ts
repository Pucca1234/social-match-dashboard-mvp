export const getZScores = (values: number[]) => {
  if (values.length === 0) return [];
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  return values.map((value) => (value - mean) / std);
};

export const getAnomalyIndices = (values: number[], threshold = 2) => {
  const zscores = getZScores(values);
  return zscores
    .map((score, index) => (Math.abs(score) >= threshold ? index : -1))
    .filter((index) => index >= 0);
};
