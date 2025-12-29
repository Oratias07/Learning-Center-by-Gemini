
export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  conversations: Conversation[];
  attachments: Attachment[];
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  STREAMING = 'STREAMING',
  ERROR = 'ERROR',
  LIVE = 'LIVE'
}
