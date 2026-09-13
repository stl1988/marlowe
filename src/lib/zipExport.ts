import JSZip from 'jszip';
import type { DirectoryEntry, JSRuntimeFS } from '@/lib/JSRuntime';

/**
 * Recursively add the contents of a VFS directory to a JSZip folder.
 * Files that fail to read are skipped with a warning.
 */
async function addFolderToZip(fs: JSRuntimeFS, dirPath: string, zipFolder: JSZip): Promise<void> {
  let entries: DirectoryEntry[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    console.warn(`Failed to read directory ${dirPath}:`, error);
    return;
  }

  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`;

    if (entry.isDirectory()) {
      const folder = zipFolder.folder(entry.name);
      if (folder) {
        await addFolderToZip(fs, fullPath, folder);
      }
    } else if (entry.isFile()) {
      try {
        const fileContent = await fs.readFile(fullPath);
        zipFolder.file(entry.name, fileContent);
      } catch (error) {
        console.warn(`Failed to read file ${fullPath}:`, error);
      }
    }
  }
}

/**
 * Zip up the contents of a VFS folder (at the ZIP root, not nested in a
 * top-level folder) and trigger a browser download.
 *
 * @param fs - The virtual filesystem to read from
 * @param folderPath - Absolute path of the folder whose contents should be zipped
 * @param zipFileName - Name of the downloaded file (e.g. `my-project-dist.zip`)
 * @throws If the folder does not exist or is not a directory
 */
export async function downloadFolderAsZip(
  fs: JSRuntimeFS,
  folderPath: string,
  zipFileName: string,
): Promise<void> {
  // Verify the folder exists before producing an empty ZIP
  const stat = await fs.stat(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`${folderPath} is not a directory`);
  }

  const zip = new JSZip();
  await addFolderToZip(fs, folderPath, zip);

  const content = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
