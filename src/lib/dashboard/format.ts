const numberFormatter = new Intl.NumberFormat("en-GB");
export const displayNumber = (value: number | null | undefined) =>
  value == null ? "—" : numberFormatter.format(value);
export const displayRate = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
export const displayDecimal = (value: number | null) =>
  value === null ? "—" : value.toFixed(1);
export const playerPath = (tag: string) =>
  `/players/${encodeURIComponent(tag.replace(/^#/, ""))}`;

export function displayDate(value: string | number, time = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(time
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  }).format(new Date(value));
}

export function displayTime(value: string | number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
