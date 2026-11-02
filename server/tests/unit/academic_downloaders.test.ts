/**
 * academic_downloaders.test.ts - Unit tests for SlideShare, Academia, and ResearchGate downloaders
 */

import { describe, it, expect } from 'vitest';
import { SlideShareService } from '../../src/services/slideshare.service.js';
import { AcademiaService } from '../../src/services/academia.service.js';
import { ResearchGateService } from '../../src/services/researchgate.service.js';

describe('Academic Downloaders URL Validation & Extraction Suite', () => {
  describe('SlideShare URL Validation', () => {
    it('accepts standard slideshare presentation URLs', () => {
      const url = 'https://www.slideshare.net/johndoe/machine-learning-introduction';
      expect(SlideShareService.extractUrl(url)).toBe(url);
    });

    it('auto-prepends https:// when protocol is missing', () => {
      const url = 'slideshare.net/author/data-structures-presentation';
      expect(SlideShareService.extractUrl(url)).toBe('https://' + url);
    });

    it('cleans dirty text pasted around slideshare URL', () => {
      const raw = 'Check this slide: https://www.slideshare.net/team/project-review. Enjoy!';
      expect(SlideShareService.extractUrl(raw)).toBe('https://www.slideshare.net/team/project-review');
    });

    it('throws BadRequestError on non-slideshare URL', () => {
      expect(() => SlideShareService.extractUrl('https://example.com/slide')).toThrow();
    });
  });

  describe('Academia.edu URL Validation', () => {
    it('accepts standard academia paper URLs', () => {
      const url = 'https://www.academia.edu/12345678/Deep_Learning_Survey_Paper';
      expect(AcademiaService.extractUrl(url)).toBe(url);
    });

    it('auto-prepends https:// when protocol is missing', () => {
      const url = 'academia.edu/87654321/Quantum_Physics_Dissertation';
      expect(AcademiaService.extractUrl(url)).toBe('https://' + url);
    });

    it('cleans dirty text pasted around academia URL', () => {
      const raw = 'Read my paper https://www.academia.edu/99887766/AI_Ethics_2026! Hope you like it.';
      expect(AcademiaService.extractUrl(raw)).toBe('https://www.academia.edu/99887766/AI_Ethics_2026');
    });

    it('throws BadRequestError on non-academia URL', () => {
      expect(() => AcademiaService.extractUrl('https://google.com')).toThrow();
    });
  });

  describe('ResearchGate URL Validation', () => {
    it('accepts standard researchgate publication URLs', () => {
      const url = 'https://www.researchgate.net/publication/345678912_Advanced_Neural_Architecture';
      expect(ResearchGateService.extractUrl(url)).toBe(url);
    });

    it('auto-prepends https:// when protocol is missing', () => {
      const url = 'researchgate.net/publication/112233445_Bioinformatics_Study';
      expect(ResearchGateService.extractUrl(url)).toBe('https://' + url);
    });

    it('cleans dirty text pasted around researchgate URL', () => {
      const raw = 'See publication: https://www.researchgate.net/publication/99001122_Nanotechnology_Advances?channel=doi.';
      expect(ResearchGateService.extractUrl(raw)).toBe('https://www.researchgate.net/publication/99001122_Nanotechnology_Advances?channel=doi');
    });

    it('throws BadRequestError on non-researchgate URL', () => {
      expect(() => ResearchGateService.extractUrl('https://wikipedia.org')).toThrow();
    });
  });
});
