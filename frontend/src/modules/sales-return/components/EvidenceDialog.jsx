import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Box, Typography, IconButton, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseIcon from '@mui/icons-material/Close';

export const MAX_EVIDENCE_PHOTOS = 5;
const MAX_DIMENSION = 1280;
const MAX_BYTES = 700_000; // decoded size target — the API accepts up to 1 MB

// Downsizes the chosen photo and re-encodes it as JPEG (quality stepped down
// until it fits) so a phone-camera shot becomes a few hundred KB and the
// upload stays well inside the API's JSON body limit.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.8;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

/**
 * Photo evidence picker for a return. Photos are held locally (previewed
 * here) and uploaded to the saved return right after "Process Return".
 */
export default function EvidenceDialog({ open, onClose, photos, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    setError('');
    const room = MAX_EVIDENCE_PHOTOS - photos.length;
    if (files.length > room) setError(`Only ${MAX_EVIDENCE_PHOTOS} photos can be attached — extra files were skipped.`);
    setBusy(true);
    try {
      const added = [];
      for (const file of files.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(room, 0))) {
        // eslint-disable-next-line no-await-in-loop
        added.push(await compressImage(file));
      }
      if (added.length) onChange([...photos, ...added]);
    } catch (err) {
      setError(err.message || 'Could not add the photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Attach Photo Evidence</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Add up to {MAX_EVIDENCE_PHOTOS} photos (damaged goods, wrong item, etc.). They are saved with the return when you process it.
          </Typography>
          {error && <Alert severity="warning" onClose={() => setError('')}>{error}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1.5 }}>
            {photos.map((photo, i) => (
              <Box key={`${photo.name}-${i}`} sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', aspectRatio: '1 / 1' }}>
                <Box component="img" src={photo.dataUrl} alt={photo.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <IconButton
                  size="small"
                  aria-label="Remove photo"
                  onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: (t) => alpha(t.palette.background.paper, 0.85), '&:hover': { bgcolor: 'background.paper' } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            {photos.length < MAX_EVIDENCE_PHOTOS && (
              <Box
                component="button"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                sx={{
                  aspectRatio: '1 / 1', borderRadius: 2, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent',
                  color: 'text.secondary', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 0.5, font: 'inherit',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.05) },
                }}
              >
                <AddPhotoAlternateOutlinedIcon />
                <Typography variant="caption">{busy ? 'Adding…' : 'Add photo'}</Typography>
              </Box>
            )}
          </Box>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {photos.length > 0 && <Button color="error" onClick={() => onChange([])}>Remove all</Button>}
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
