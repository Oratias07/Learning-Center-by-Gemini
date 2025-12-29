
export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
  extractedText?: string; // For searching within content
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
  categoryId: string; // Link to parent category
  userId: string;     // Link to owner (e.g., 'guest' or user email)
}

export interface Category {
  id: string;
  name: string;
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
