
export enum PartCategory {
  CPU = 'CPU',
  RAM = '内存',
  DISK = '硬盘',
  NIC = '网卡',
  CABLE = '线缆',
  PSU = '电源',
  OTHER = '其他',
}

export enum PartStatus {
  NEW = '全新',
  USED = '二手',
  FAULTY = '故障',
}

export interface InventoryItem {
  id: string;
  sn: string; // Serial Number
  name: string;
  category: PartCategory;
  model: string;
  quantity: number;
  status: PartStatus;
  location: string; // e.g., "Shelf A-01"
  lastUpdated: string;
  notes?: string;
}

export interface AIAnalysisResult {
  name?: string;
  category?: string;
  model?: string;
  spec?: string;
  confidence?: number;
  reasoning?: string;
  sn?: string;
  manufacturer?: string;
  all_text?: string[];
}
