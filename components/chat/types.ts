export type Attachment = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  size?: number;
  duration?: number;
};

export type Reactions = Record<string, string[]>;

export type Message = {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read_at: string | null;
  attachments: Attachment[];
  is_edited: boolean;
  reactions?: Reactions | null;
};

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onReferencePress?: () => void;
  onAttach: () => void;
  isRecording: boolean;
  onRecordPressIn: () => void;
  onRecordPressOut: () => void;
  isLoading?: boolean;
}
