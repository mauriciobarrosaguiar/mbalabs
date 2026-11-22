export function hasDroneCoordinates(value: {latitude?: unknown; longitude?: unknown}) {
  const coordinate = (v: unknown, limit: number) =>
    (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) &&
    Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit;
  return coordinate(value.latitude, 90) && coordinate(value.longitude, 180);
}
