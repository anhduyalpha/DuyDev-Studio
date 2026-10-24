import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ProfileModal Apple Glass Theme & Zero-Orange Enforcement Suite', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const modalPath = path.join(rootDir, 'src/components/common/ProfileModal.js');

  it('1. ProfileModal.js must not contain any harsh orange color tokens', () => {
    const content = fs.readFileSync(modalPath, 'utf-8');
    const orangeMatches = content.match(/orange-\d+/g);
    expect(orangeMatches).toBeNull();
  });

  it('2. ProfileModal.js must implement Apple frosted glass styling and 44px+ touch targets', () => {
    const content = fs.readFileSync(modalPath, 'utf-8');

    // Frosted glass backdrop and rounded-3xl container
    expect(content).toContain('backdrop-blur-2xl');
    expect(content).toContain('rounded-3xl');

    // Apple Indigo accent buttons and borders
    expect(content).toContain('bg-indigo-600');
    expect(content).toContain('text-indigo-600');

    // Specular top hairline
    expect(content).toContain('via-indigo-500/40');

    // Ergonomic touch targets: h-12 (48px)
    expect(content).toContain('h-12');
  });

  it('3. ProfileModal.js preserves all crucial DOM element IDs', () => {
    const content = fs.readFileSync(modalPath, 'utf-8');
    expect(content).toContain("modalOverlay.id = 'dsProfileModalOverlay'");

    const requiredIds = [
      'dsProfileModalCard',
      'dsProfileModalTitle',
      'dsProfileNameInput',
      'dsProfileNameError',
      'dsProfileNextStepBtn',
      'dsModalAvatarPreview',
      'dsModalNamePreview',
      'dsProfileNameInput2',
      'dsProfileResetInitialBtn',
      'dsProfileUploadPhotoBtn',
      'dsProfileFileInput',
      'dsProfileSaveAllBtn'
    ];

    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });
});
