const MAX_SIZE = 300; // px, longest side — plenty for an 80mm thermal receipt

/**
 * Reads an uploaded image file and returns it as a small PNG data URL:
 * scaled down so the longest side is at most MAX_SIZE px and drawn on a
 * white background (transparent areas would otherwise print as solid
 * black on a thermal printer). Rejects if the file isn't a readable image.
 */
export function logoFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith('image/')) {
      reject(new Error('Not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Default company logo shipped with the app (frontend/public/smalogo.jpeg).
// Used wherever the Company master has no uploaded logo of its own, so the
// SMA mark still shows on the Company page and at the top of printouts.
export const DEFAULT_COMPANY_LOGO_PATH = '/smalogo.jpeg';

/** Absolute URL of the default logo — printouts render inside an about:srcdoc
 *  iframe, where a root-relative path would not resolve. */
export const defaultCompanyLogoUrl = () =>
  (typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}${DEFAULT_COMPANY_LOGO_PATH}`
    : DEFAULT_COMPANY_LOGO_PATH);
