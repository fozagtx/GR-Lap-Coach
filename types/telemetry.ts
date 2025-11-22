export interface TelemetryRow {
  timestamp: number;
  Laptrigger_lapdist_dls: number;
  Speed: number;
  Steering_Angle: number;
  pbrake_f: number;
  aps: number;
}

export interface ParsedLap {
  lapNumber: number;
  startIndex: number;
  endIndex: number;
  data: TelemetryRow[];
  lapTime: number;
}

export interface Sector {
  name: string;
  distanceStart: number;
  distanceEnd: number;
  time: number;
  data: TelemetryRow[];
  lapNumber: number;
  maxSpeed: number;
}

export interface SectorStats {
  sectorName: string;
  bestTime: number;
  lapNumber: number;
  timeGain: number;
  avgSpeed: number;
}

export interface PerfectLapResult {
  theoreticalTime: number;
  chartData: Array<{
    distance: number;
    speed: number;
    sector: string;
  }>;
  sectorStats: SectorStats[];
  bestSectors: Sector[];
}
