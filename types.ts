export interface MapItem {
  id: string;
  title: string;
  description: string;
  type: 'file' | 'image' | 'document';
  size: string;
  dateModified: string;
  previewUrl?: string;
  // New fields for metadata
  category?: string;
  customName?: string;
  notes?: string;
}