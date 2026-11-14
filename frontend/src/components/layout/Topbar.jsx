import { useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Box, Tooltip, Menu, MenuItem, ListItemText,
} from '@mui/material';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  toggleThemeMode, selectThemeMode, setAccentTheme, selectAccentThemeKey,
} from '../../features/ui/uiSlice';
import { ACCENT_THEMES, accentCssBackground } from '../../theme/accentThemes';
import GlobalSearch from './GlobalSearch';
import OutletSwitcher from './OutletSwitcher';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';

// Accent color picker, sitting right next to the light/dark toggle: six
// flat colors + six two-color gradient combos (ACCENT_THEMES), each shown
// as a small round swatch with the selected row highlighted — separate from
// light/dark mode, which controls the page background/text palette.
function AccentThemeMenu() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const accentThemeKey = useAppSelector(selectAccentThemeKey);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleSelect = (key) => {
    setAnchorEl(null);
    dispatch(setAccentTheme(key));
  };

  return (
    <>
      <Tooltip title={t('common.themeColor')}>
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
          <PaletteOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { maxHeight: 420 } } }}
      >
        {ACCENT_THEMES.map((accent) => (
          <MenuItem key={accent.key} selected={accentThemeKey === accent.key} onClick={() => handleSelect(accent.key)}>
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                mr: 1.5,
                flexShrink: 0,
                background: accentCssBackground(accent),
              }}
            />
            <ListItemText>{accent.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default function Topbar({ onMenuClick }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(selectThemeMode);
  const isDark = themeMode === 'dark';

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, py: 1 }}>
        <IconButton onClick={onMenuClick} edge="start">
          <MenuOutlinedIcon />
        </IconButton>

        <OutletSwitcher />

        <Box sx={{ flex: '0 1 480px', display: { xs: 'none', md: 'block' } }}>
          <GlobalSearch placeholder={t('common.searchPlaceholder')} />
        </Box>

        {/* Always-present spacer — absorbs whatever space the (capped) search
            bar doesn't use, so notifications/theme-toggle/user stay pinned to
            the far right corner on every breakpoint instead of trailing the
            search box. */}
        <Box sx={{ flex: 1 }} />

        <NotificationBell />

        <Tooltip title={isDark ? t('common.switchToLightMode') : t('common.switchToDarkMode')}>
          <IconButton onClick={() => dispatch(toggleThemeMode())}>
            {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
          </IconButton>
        </Tooltip>

        <AccentThemeMenu />

        {/* Language switcher — icon opens a menu of English / Tamil / Hindi
            (LANGUAGE_OPTIONS in features/ui/uiSlice.js). Selecting one
            updates redux `ui.language`, which useSyncLanguage (mounted near
            the app root) mirrors into i18next, retranslating the sidebar
            and its submenus instantly. */}
        <LanguageSwitcher />

        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
