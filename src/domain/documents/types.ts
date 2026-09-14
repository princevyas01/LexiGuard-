export interface TextSpan {
  start: number;
  end: number;
  text: string;
}

export interface Clause {
  id: string;
  clauseNumber?: string;
  title?: string;
  text: string;
  pageNumber: number | null;
  sectionId: string;
  span: TextSpan;
}

export interface DocumentSection {
  id: string;
  sectionNumber?: string;
  title: string;
  clauses: Clause[];
  pageNumber: number | null;
  span: TextSpan;
}

export interface DocumentMetadata {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
  characterCount: number;
  sha256Hash: string;
  ingestedAt: string;
  isScannedOrLowText: boolean;
  detectedTitle?: string;
  detectedParties?: string[];
  detectedGoverningLaw?: string;
}

export interface Document {
  id: string;
  versionId: string;
  metadata: DocumentMetadata;
  rawText: string;
  sections: DocumentSection[];
  clauses: Clause[];
}
