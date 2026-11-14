import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Link,
  Divider,
  InputAdornment,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PinIcon from '@mui/icons-material/Pin';

import { useAppDispatch } from '../../app/hooks';
import { useLoginMutation } from '../../api/authApi';
import { setCredentials } from '../../features/auth/authSlice';
import { showToast } from '../../features/ui/uiSlice';
import FormTextField from '../../components/form/FormTextField';
import FormPasswordField from '../../components/form/FormPasswordField';
import FormSelect from '../../components/form/FormSelect';
import FormCheckbox from '../../components/form/FormCheckbox';
import AppLogo from '../../components/common/AppLogo';
import HealthStatusTag from '../../components/common/HealthStatusTag';
import { useHealthStatus } from '../../hooks/useHealthStatus';
import { useGetPublicOutletsQuery } from '../../api/outletApi';
import { loginSchema, loginDefaultValues } from './loginSchema';
import LoginMarketingPanel from './components/LoginMarketingPanel';
import loginBackground from '../../assets/LoginImage5.png';

const APP_VERSION = '1.0.0';
const TENANT_NAME = 'Kayal Agro Foods'; // TODO: replace with tenant context once multi-tenant lookup exists

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [login, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState(null);
  const { status: healthStatus, services: healthServices } = useHealthStatus();
  const { data: outlets = [], isLoading: outletsLoading } = useGetPublicOutletsQuery();
  const outletOptions = outlets.map((outlet) => ({ value: outlet.id, label: outlet.name }));

  const methods = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: loginDefaultValues,
    // A field only shows its error once the user has focused it and left
    // (first blur), then revalidates live as they fix it — avoids flashing
    // "required" errors before the user has even reached a field.
    mode: 'onTouched',
  });

  // Login button stays disabled until every field has a value — separate
  // from the onTouched error display above, which only shows messages
  // after a field is visited. Watched directly (not via formState.isValid)
  // so it reflects raw field values ("is anything typed") rather than full
  // schema validity, which shouldn't gate the button on username/password
  // format the backend already checks.
  const [watchedUsername, watchedPassword, watchedOutletId] = useWatch({
    control: methods.control,
    name: ['username', 'password', 'outletId'],
  });
  const allFieldsFilled = Boolean(watchedUsername?.trim()) && Boolean(watchedPassword) && Boolean(watchedOutletId);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const result = await login({
        username: values.username,
        password: values.password,
        outletId: values.outletId,
      }).unwrap();

      dispatch(setCredentials(result, values.rememberMe));
      dispatch(showToast(`Welcome back, ${result.user.name}!`, 'success'));
      navigate('/home', { replace: true });
    } catch (err) {
      setServerError(err?.data?.message || 'Unable to sign in. Please try again.');
    }
  };

  const handleComingSoon = (feature) => {
    dispatch(showToast(`${feature} is coming soon`, 'info'));
  };

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        width: '100%',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* Desktop only: the product photo covers the *entire* page edge-to-
          edge as a fixed background layer, with the brand copy and login
          card both floating on top of it. Phones/small tablets fall back to
          a plain background with just the centered login card (below). */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', inset: 0, zIndex: 0 }}>
        <Box
          component="img"
          src={loginBackground}
          alt=""
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
          }}
        />
        <Box sx={{ position: 'relative', height: '100%', width: '60%' }}>
          <LoginMarketingPanel />
        </Box>
      </Box>

      {/* Login card — floats over the photo as a self-contained card with
          a gap all around it (not flush to any edge), vertically centered
          and pinned toward the right on desktop; falls back to a normal
          centered column (no image) on phones/small tablets. */}
      <Box
        sx={{
          position: { xs: 'relative', md: 'absolute' },
          zIndex: 1,
          top: { md: '50%' },
          right: { md: 48 },
          transform: { md: 'translateY(-50%)' },
          // Fixed, content-sized height — deliberately NOT tied to 100vh/vh
          // units, so the card's own dimensions stay exactly the same
          // regardless of window size or browser zoom level. Only the
          // *position* (top/right offsets above) is responsive.
          height: { xs: '100%', md: 'auto' },
          width: { xs: '100%', md: 'auto' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4, md: 0 },
          py: { xs: 3, md: 0 },
          overflowY: 'auto',
        }}
      >
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: 420,
            px: { xs: 3, sm: 4, md: 5 },
            py: { xs: 3, sm: 4, md: 4 },
            borderRadius: 4,
            // Glass card on desktop (blurred, semi-transparent so the photo
            // shows through) — tinted to match whichever mode is active,
            // so dark mode gets a dark-tinted glass card instead of a
            // white one with unreadable light-on-light text, and light
            // mode keeps the original near-white glass look.
            bgcolor: {
              xs: 'background.paper',
              md: (t) => (t.palette.mode === 'dark' ? 'rgba(26, 31, 43, 0.85)' : 'rgba(255, 255, 255, 0.95)'),
            },
            backdropFilter: { md: 'blur(16px)' },
            border: {
              md: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.6)'}`,
            },
          }}
        >
          <Stack spacing={1.75} sx={{ width: '100%' }}>
            <Stack spacing={0.75} sx={{ alignItems: 'center' }}>
              <AppLogo iconSize={32} titleFontSize="1.05rem" subtitleFontSize="0.56rem" />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Welcome to <Box component="span" sx={{ color: 'primary.main' }}>Nexora</Box> POS
                </Typography>
                <Box sx={{ width: 44, height: 3, bgcolor: 'primary.main', borderRadius: 1, mx: 'auto', mt: 0.5 }} />
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                  {TENANT_NAME}
                </Typography>
              </Box>
            </Stack>

            <FormProvider {...methods}>
              <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
                <Stack spacing={1.25}>
                  {serverError && (
                    <Typography variant="body2" color="error" role="alert">
                      {serverError}
                    </Typography>
                  )}

                  <FormTextField
                    name="username"
                    label="Username"
                    autoComplete="username"
                    size="small"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutlineIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <FormPasswordField
                    name="password"
                    label="Password"
                    autoComplete="current-password"
                    size="small"
                  />

                  <FormSelect
                    name="outletId"
                    label="Select Outlet"
                    options={outletOptions}
                    disabled={outletsLoading}
                    size="small"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <StorefrontIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormCheckbox
                      name="rememberMe"
                      label={<Typography variant="body2">Remember me</Typography>}
                    />
                    <Link
                      component="button"
                      type="button"
                      variant="body2"
                      underline="hover"
                      onClick={() => handleComingSoon('Forgot password')}
                    >
                      Forgot Password?
                    </Link>
                  </Stack>

                  <Button type="submit" variant="contained" size="medium" disabled={isLoading || !allFieldsFilled} fullWidth>
                    {isLoading ? 'Signing in…' : 'Login'}
                  </Button>

                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <HealthStatusTag status={healthStatus} services={healthServices} />
                  </Box>

                  <Divider>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      OR
                    </Typography>
                  </Divider>

                  <Button
                    variant="outlined"
                    size="medium"
                    fullWidth
                    startIcon={<PinIcon />}
                    onClick={() => handleComingSoon('Login with PIN')}
                  >
                    Login with PIN
                  </Button>
                </Stack>
              </Box>
            </FormProvider>

            <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary' }}>
              Version {APP_VERSION}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
