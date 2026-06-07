import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { simulationEngineService } from './SimulationEngineService.js';
import { config } from '../config/index.js';
import type { ProteinStructure, LigandStructure } from './SimulationEngineService.js';

export interface UploadedFile {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  fileType: 'pdb' | 'sdf';
  uploadedAt: string;
  md5Hash?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    atomCount?: number;
    residueCount?: number;
    molecularWeight?: number;
    formula?: string;
  };
}

export interface FileInfo {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  fileType: 'pdb' | 'sdf';
  uploadedAt: string;
  metadata?: {
    atomCount?: number;
    residueCount?: number;
    molecularWeight?: number;
    formula?: string;
    resolution?: number;
    title?: string;
  };
}

const ALLOWED_EXTENSIONS = ['.pdb', '.sdf', '.ent'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

class FileProcessingService {
  private readonly uploadDir: string;
  private readonly pdbDir: string;
  private readonly sdfDir: string;

  constructor() {
    this.uploadDir = config.uploadDir;
    this.pdbDir = path.join(this.uploadDir, 'pdb');
    this.sdfDir = path.join(this.uploadDir, 'sdf');
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [this.uploadDir, this.pdbDir, this.sdfDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async processUpload(
    file: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype?: string;
    },
    expectedType: 'pdb' | 'sdf'
  ): Promise<UploadedFile> {
    const validation = this.validateFile(file, expectedType);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const fileId = nanoid(12);
    const extension = path.extname(file.originalname).toLowerCase();
    const storedName = `${fileId}${extension}`;
    
    const targetDir = expectedType === 'pdb' ? this.pdbDir : this.sdfDir;
    const filePath = path.join(targetDir, storedName);

    await fs.promises.writeFile(filePath, file.buffer);

    const contentValidation = this.validateFileContent(filePath, expectedType);
    if (!contentValidation.valid) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw new Error(`File content validation failed: ${contentValidation.errors.join(', ')}`);
    }

    return {
      id: fileId,
      originalName: file.originalname,
      storedName,
      filePath,
      fileSize: file.size,
      fileType: expectedType,
      uploadedAt: new Date().toISOString(),
    };
  }

  validateFile(
    file: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype?: string;
    },
    expectedType: 'pdb' | 'sdf'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const extension = path.extname(file.originalname).toLowerCase();
    const expectedExtensions = expectedType === 'pdb' ? ['.pdb', '.ent'] : ['.sdf'];
    
    if (!expectedExtensions.includes(extension)) {
      errors.push(`Invalid file extension. Expected ${expectedExtensions.join(' or ')}, got ${extension}`);
    }

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size ${file.size} exceeds maximum allowed size ${MAX_FILE_SIZE}`);
    }

    if (file.size > 10 * 1024 * 1024) {
      warnings.push('File is large and may take longer to process');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateFileContent(
    filePath: string,
    fileType: 'pdb' | 'sdf'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: ValidationResult['metadata'] = {};

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.trim().length === 0) {
        errors.push('File content is empty');
        return { valid: false, errors, warnings };
      }

      if (fileType === 'pdb') {
        const pdbValidation = simulationEngineService.validatePDBContent(content);
        errors.push(...pdbValidation.errors);

        if (pdbValidation.valid) {
          const structure = simulationEngineService.parsePDB(filePath);
          metadata.atomCount = structure.atoms.length;
          metadata.residueCount = structure.residues.length;
          
          if (structure.atoms.length === 0) {
            errors.push('No atoms found in PDB file');
          }
          
          if (structure.residues.length === 0) {
            errors.push('No residues found in PDB file');
          }
          
          if (structure.resolution && structure.resolution > 3.0) {
            warnings.push(`Low resolution structure (${structure.resolution} Å) may affect simulation quality`);
          }
        }
      } else {
        const sdfValidation = simulationEngineService.validateSDFContent(content);
        errors.push(...sdfValidation.errors);

        if (sdfValidation.valid) {
          const ligand = simulationEngineService.parseSDF(filePath);
          metadata.atomCount = ligand.atoms.length;
          metadata.molecularWeight = ligand.molecularWeight;
          metadata.formula = ligand.formula;
          
          if (ligand.atoms.length === 0) {
            errors.push('No atoms found in SDF file');
          }
          
          if (ligand.bonds.length === 0) {
            warnings.push('No bonds found in SDF file');
          }
          
          if (ligand.molecularWeight && ligand.molecularWeight > 1000) {
            warnings.push('Large ligand molecule may require longer simulation time');
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  }

  getFilePath(fileId: string, fileType: 'pdb' | 'sdf'): string | null {
    const targetDir = fileType === 'pdb' ? this.pdbDir : this.sdfDir;
    const extensions = fileType === 'pdb' ? ['.pdb', '.ent'] : ['.sdf'];
    
    for (const ext of extensions) {
      const filePath = path.join(targetDir, `${fileId}${ext}`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    
    return null;
  }

  getFileInfo(fileId: string, fileType: 'pdb' | 'sdf'): FileInfo | null {
    const filePath = this.getFilePath(fileId, fileType);
    if (!filePath) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const storedName = path.basename(filePath);
    
    const info: FileInfo = {
      id: fileId,
      originalName: storedName,
      storedName,
      filePath,
      fileSize: stats.size,
      fileType,
      uploadedAt: stats.birthtime.toISOString(),
    };

    try {
      if (fileType === 'pdb') {
        const structure = simulationEngineService.parsePDB(filePath);
        info.metadata = {
          atomCount: structure.atoms.length,
          residueCount: structure.residues.length,
          resolution: structure.resolution,
          title: structure.title,
        };
      } else {
        const ligand = simulationEngineService.parseSDF(filePath);
        info.metadata = {
          atomCount: ligand.atoms.length,
          molecularWeight: ligand.molecularWeight,
          formula: ligand.formula,
        };
      }
    } catch {
    }

    return info;
  }

  deleteFile(fileId: string, fileType: 'pdb' | 'sdf'): boolean {
    const filePath = this.getFilePath(fileId, fileType);
    if (!filePath) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  parsePDB(filePath: string): ProteinStructure {
    return simulationEngineService.parsePDB(filePath);
  }

  parseSDF(filePath: string): LigandStructure {
    return simulationEngineService.parseSDF(filePath);
  }

  getFileContent(fileId: string, fileType: 'pdb' | 'sdf'): string | null {
    const filePath = this.getFilePath(fileId, fileType);
    if (!filePath) {
      return null;
    }

    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  listFiles(fileType?: 'pdb' | 'sdf'): FileInfo[] {
    const files: FileInfo[] = [];
    
    const processDir = (dir: string, type: 'pdb' | 'sdf') => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const fileId = path.basename(entry, path.extname(entry));
          const info = this.getFileInfo(fileId, type);
          if (info) {
            files.push(info);
          }
        }
      }
    };

    if (!fileType || fileType === 'pdb') {
      processDir(this.pdbDir, 'pdb');
    }
    
    if (!fileType || fileType === 'sdf') {
      processDir(this.sdfDir, 'sdf');
    }

    return files.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  getStorageStats(): {
    totalFiles: number;
    totalSize: number;
    pdbCount: number;
    sdfCount: number;
    pdbSize: number;
    sdfSize: number;
  } {
    const calculateDirSize = (dir: string): { count: number; size: number } => {
      if (!fs.existsSync(dir)) {
        return { count: 0, size: 0 };
      }
      
      let count = 0;
      let size = 0;
      
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          count++;
          size += stats.size;
        }
      }
      
      return { count, size };
    };

    const pdbStats = calculateDirSize(this.pdbDir);
    const sdfStats = calculateDirSize(this.sdfDir);

    return {
      totalFiles: pdbStats.count + sdfStats.count,
      totalSize: pdbStats.size + sdfStats.size,
      pdbCount: pdbStats.count,
      sdfCount: sdfStats.count,
      pdbSize: pdbStats.size,
      sdfSize: sdfStats.size,
    };
  }

  cleanOldFiles(maxAgeDays: number = 30): number {
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const cleanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && now - stats.birthtime.getTime() > maxAge) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch {
          }
        }
      }
    };

    cleanDir(this.pdbDir);
    cleanDir(this.sdfDir);

    return deletedCount;
  }

  generateFilePath(taskId: string, fileType: 'pdb' | 'sdf', originalName: string): string {
    const extension = path.extname(originalName).toLowerCase() || (fileType === 'pdb' ? '.pdb' : '.sdf');
    const targetDir = fileType === 'pdb' ? this.pdbDir : this.sdfDir;
    return path.join(targetDir, `${taskId}_${Date.now()}${extension}`);
  }

  saveFileFromBuffer(
    buffer: Buffer,
    taskId: string,
    fileType: 'pdb' | 'sdf',
    originalName: string
  ): UploadedFile {
    const filePath = this.generateFilePath(taskId, fileType, originalName);
    const storedName = path.basename(filePath);
    
    fs.writeFileSync(filePath, buffer);

    return {
      id: taskId,
      originalName,
      storedName,
      filePath,
      fileSize: buffer.length,
      fileType,
      uploadedAt: new Date().toISOString(),
    };
  }
}

export const fileProcessingService = new FileProcessingService();
