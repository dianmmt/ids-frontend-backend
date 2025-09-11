export type NotificationType = 'attack' | 'performance';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string; // ISO string
}




