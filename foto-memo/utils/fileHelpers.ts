import { MapItem } from '../types';

export const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const getFileType = (file: File): 'file' | 'image' | 'document' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.type.includes('text/')) return 'document';

  const name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) return 'image';
  if (/\.(pdf|txt|doc|docx|xls|xlsx|ppt|pptx|md|json)$/.test(name)) return 'document';

  return 'file';
};

export const processFileToItem = async (file: File): Promise<{ mapItem: MapItem, buffer: ArrayBuffer }> => {
    const type = getFileType(file);
    const id = `local-${file.name}-${file.size}`;
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });
    const previewUrl = URL.createObjectURL(blob);

    const mapItem: MapItem = {
        id,
        title: file.name,
        description: `Afbeelding (${formatSize(file.size)})`,
        type,
        size: formatSize(file.size),
        dateModified: new Date(file.lastModified).toLocaleDateString('nl-NL'),
        previewUrl,
        category: 'Nog te sorteren', // Default category
        customName: file.name
    };

    return { mapItem, buffer };
};