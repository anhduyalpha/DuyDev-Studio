/**
 * Global ambient declarations for DuyDev Studio PWA (Zero-Build Native ES Modules)
 */

interface Window {
  lucide?: {
    createIcons: (options?: { root?: HTMLElement | Document | Element | null }) => void;
  };
  QRCodeStyling?: any;
  ThinkingOrbs?: any;
  BarcodeDetector?: any;
  ClipboardItem?: any;
  clipboardData?: DataTransfer;
}

interface Navigator {
  standalone?: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
