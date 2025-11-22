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

export interface BrakingZone {
  sector: string;
  distance: number;
  entrySpeed: number;
  exitSpeed: number;
  brakePressure: number;
  lapNumber: number;
}

export interface AccelerationZone {
  sector: string;
  distance: number;
  entrySpeed: number;
  exitSpeed: number;
  avgThrottle: number;
  lapNumber: number;
}

export interface CornerAnalysis {
  sector: string;
  distance: number;
  minSpeed: number;
  lapNumber: number;
  entrySpeed: number;
  exitSpeed: number;
}

export interface SpeedDeficit {
  sector: string;
  distance: number;
  speedLoss: number;
  bestSpeed: number;
  avgSpeed: number;
  description: string;
}

export interface ConsistencyMetrics {
  avgLapTime: number;
  bestLapTime: number;
  worstLapTime: number;
  stdDeviation: number;
  lapTimeVariation: number[];
  consistencyScore: number; // 0-100, higher is better
}

export interface ImprovementArea {
  area: string;
  sector: string;
  timeLoss: number;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
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
  consistency?: ConsistencyMetrics;
  improvementAreas?: ImprovementArea[];
  brakingZones?: BrakingZone[];
  accelerationZones?: AccelerationZone[];
  cornerAnalysis?: CornerAnalysis[];
  speedDeficits?: SpeedDeficit[];
}
