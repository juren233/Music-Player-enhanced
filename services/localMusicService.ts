
import JSZip from 'jszip';
import { Track } from '../types';

const DEFAULT_COVER = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop";

export const processLocalArchive = async (file: File): Promise<Track[]> => {
    const zip = new JSZip();
    try {
        const contents = await zip.loadAsync(file);
        const tracks: Track[] = [];
        // Use negative IDs for local tracks to avoid collision with API IDs
        let idCounter = -Date.now(); 

        for (const [filename, entry] of Object.entries(contents.files)) {
            // Explicitly cast entry to JSZip.JSZipObject (or any) to fix TS 'unknown' error
            const zipEntry = entry as JSZip.JSZipObject;

            // Skip directories and MacOS hidden files
            if (zipEntry.dir || filename.startsWith('__MACOSX') || filename.includes('/.')) continue;
            
            const lowerName = filename.toLowerCase();
            // Basic support for common web audio formats
            if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.ogg') || lowerName.endsWith('.m4a')) {
                const blob = await zipEntry.async('blob');
                const url = URL.createObjectURL(blob);
                
                // Simple name parsing: remove path and extension
                const cleanName = filename.split('/').pop()?.replace(/\.[^/.]+$/, "") || filename;
                
                tracks.push({
                    id: idCounter--,
                    name: cleanName,
                    ar: [{ id: 0, name: 'Local Artist' }],
                    al: { id: 0, name: 'Local Import', picUrl: DEFAULT_COVER },
                    dt: 0, // Duration is unknown until loaded
                    sourceUrl: url
                });
            }
        }
        
        // Sort by filename for consistent ordering
        return tracks.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error("Failed to unzip", e);
        throw new Error("无法读取文件，请确保格式为 ZIP");
    }
};
