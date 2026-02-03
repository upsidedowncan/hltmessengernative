import { ViewStyle, TextStyle } from 'react-native';

export type Attachment = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  size?: number;
  duration?: number;
};

export interface ChatBubbleProps {
  id: string;
  content: string;
  senderId: string;
  currentUserId: string;
  createdAt: string;
  isLastInGroup?: boolean;
  isEdited?: boolean;
  readAt?: string | null;
  imageUrl?: string;
  imageCaption?: string;
  attachments?: Attachment[];
  isStreaming?: boolean;
  onCopy?: (text: string) => void;
  onImagePress?: (url: string) => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  markdownStyles?: {
    body?: TextStyle;
    paragraph?: TextStyle;
    link?: TextStyle;
    strong?: TextStyle;
    em?: TextStyle;
    code?: TextStyle;
    pre?: TextStyle;
    blockquote?: TextStyle;
    bullet_list?: ViewStyle;
    ordered_list?: ViewStyle;
    list_item?: ViewStyle;
    bullet_list_icon?: ViewStyle;
    ordered_list_icon?: ViewStyle;
  };
}

export interface ChatBubbleStyles {
  bubble: ViewStyle;
  bubbleContent: ViewStyle;
  imageContainer: ViewStyle;
  image: ViewStyle;
  attachmentContainer: ViewStyle;
  fileAttachment: ViewStyle;
  metadataContainer: ViewStyle;
  timestamp: TextStyle;
  readIndicator: ViewStyle;
  streamingIndicator: ViewStyle;
}
