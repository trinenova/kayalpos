import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stack,
  Box,
  Typography,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Grid,
  Breadcrumbs,
  Link as MuiLink,
  Tooltip,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import { Link as RouterLink } from "react-router-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { showToast } from "../../features/ui/uiSlice";
import { formatCurrency } from "../../utils/format";
import AddCustomerDialog from "../../components/common/AddCustomerDialog";
import { useGetProductsQuery } from "../../api/productApi";
import { useGetItemGroupsQuery } from "../../api/itemGroupApi";
import { useNextBillNoQuery, useCreateSaleMutation } from "../../api/saleApi";
import {
  useHeldBillsQuery,
  useHoldBillMutation,
  useUpdateHeldBillMutation,
  useResumeHeldBillMutation,
  useDiscardHeldBillMutation,
} from "../../api/heldBillApi";

import LineSaleTopBar from "./components/LineSaleTopBar";
import CustomerSearchBar from "./components/CustomerSearchBar";
import CurrentSaleTable from "./components/CurrentSaleTable";
import BillSummaryPanel from "./components/BillSummaryPanel";
import BillInfoCard from "./components/BillInfoCard";
import CustomerDetailsCard from "./components/CustomerDetailsCard";
import PaymentMethodsCard from "./components/PaymentMethodsCard";
import PaymentActionsCard from "./components/PaymentActionsCard";
import AmountPayableCard from "./components/AmountPayableCard";
import HeldBillsDialog from "./components/HeldBillsDialog";
import ItemChoiceDialog from "./components/ItemChoiceDialog";
import { PAYMENT_METHODS, WALK_IN_CUSTOMER, TAX_RATE } from "./lineSaleMockData";
import { printReceipt } from "./receiptPrint";
import AppLogo from "../../components/common/AppLogo";
import { useCompanyProfileQuery } from "../../api/companyApi";
import { useGetProductLotsQuery } from "../../api/productLotApi";
import { useGetTaxCodesQuery } from "../../api/taxCodeApi";
import { fifoAveragePrice, groupLotsByProduct } from "./fifoPricing";

// Quick-cash chips next to the "Exact" chip (which fills the bill total).
const QUICK_AMOUNTS = [100, 500, 2000];

const PAYMENT_STEPS = [
  { key: "billing", label: "Cart & Items" },
  { key: "payment", label: "Payment & Print" },
];

// Cart & Items -> Payment & Print progress header shown on the payment step.
function StepProgress({ current }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "center", gap: 2 }}
    >
      {PAYMENT_STEPS.map((st, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Stack
            key={st.key}
            direction="row"
            sx={{ alignItems: "center", gap: 2 }}
          >
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  bgcolor: active
                    ? "primary.main"
                    : (t) => alpha(t.palette.primary.main, 0.12),
                  color: active ? "primary.contrastText" : "primary.main",
                }}
              >
                {done ? <CheckIcon sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: active ? 800 : 600,
                  color: active ? "text.primary" : "text.secondary",
                }}
              >
                {st.label}
              </Typography>
            </Stack>
            {i < PAYMENT_STEPS.length - 1 && (
              <Box
                sx={{
                  width: { xs: 40, sm: 100 },
                  height: 2,
                  bgcolor: "primary.main",
                  borderRadius: 1,
                }}
              />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

/**
 * POS billing screen — scan/search items on the left, build the current
 * sale on the right, settle it at the bottom. Fully wired to the backend:
 * items come from the real Product master, the customer picker/creator hits
 * the real Customer table, the Bill No. field previews the next real
 * sequence number, and "Pay & Print" actually creates the Sale (+ its
 * SaleLine rows) and decrements stock server-side — see
 * backend/src/modules/sale for the transaction that makes this atomic.
 * Only local UI state (cart-in-progress, discount inputs, chosen payment
 * method) lives on the client until the moment of payment.
 */
export default function LineSalePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);

  const { data: products = [] } = useGetProductsQuery({ status: "ACTIVE" });
  // "Counter" = an Item Group (Masters > Item Group). Picking one limits the
  // item / barcode search below to that counter's products; "" = all counters.
  const { data: itemGroups = [] } = useGetItemGroupsQuery({ status: "ACTIVE" });
  const [counter, setCounter] = useState("");
  const counterProducts = useMemo(
    () => (counter ? products.filter((p) => p.group === counter) : products),
    [products, counter],
  );
  const {
    data: previewBillNo,
    isLoading: isLoadingBillNo,
    isError: billNoError,
  } = useNextBillNoQuery();
  const [createSale, { isLoading: isPaying }] = useCreateSaleMutation();
  // Header details (business name/address/GSTIN/phone) for the printed
  // receipt — null when the tenant hasn't saved a Company profile yet.
  const { data: companyProfile } = useCompanyProfileQuery();

  // Held ("parked") bills — saved carts, never sales (see modules/held-bill
  // on the backend). refetchOnMountOrArgChange re-reads the server list every
  // time this screen opens, so a refresh/restart/other till always shows the
  // truth rather than a stale cache.
  const {
    data: heldBills = [],
    isLoading: isLoadingHeld,
    isFetching: isFetchingHeld,
    isError: heldError,
    refetch: refetchHeld,
  } = useHeldBillsQuery(undefined, {
    refetchOnMountOrArgChange: true,
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
  });
  const [holdBill, { isLoading: isHolding }] = useHoldBillMutation();
  const [updateHeldBill, { isLoading: isUpdatingHeld }] =
    useUpdateHeldBillMutation();
  const [resumeHeldBill, { isLoading: isResuming }] =
    useResumeHeldBillMutation();
  const [discardHeldBill] = useDiscardHeldBillMutation();

  // The real logged-in cashier's name (set at login — see LoginPage's
  // setCredentials(result, ...) call), never a hardcoded placeholder. If
  // this shows something unexpected, the session's auth state itself is the
  // thing to check, not this page.
  const cashierName = user?.name || "Not logged in";

  // code -> live product, used to resolve price/stock/productId whenever an
  // item is added or its quantity changed, so the cart never drifts from
  // what the Product master actually has on hand.
  // GST is per product: its Tax Code (Masters > Tax Code) rate, matched by
  // name or code like the server does; no/unknown code falls back to the flat
  // default. The server recomputes this at pay time — this keeps the screen
  // in step with it.
  const { data: taxCodes = [] } = useGetTaxCodesQuery({ status: "ACTIVE" });
  const taxRateOf = useMemo(() => {
    const byKey = new Map();
    taxCodes.forEach((t) => {
      const rate = Number(t.rate) / 100;
      byKey.set(String(t.name).trim().toLowerCase(), rate);
      const codeKey = String(t.code).trim().toLowerCase();
      if (!byKey.has(codeKey)) byKey.set(codeKey, rate);
    });
    return (product) => {
      const key = String(product?.taxCode || "").trim().toLowerCase();
      return key && byKey.has(key) ? byKey.get(key) : TAX_RATE;
    };
  }, [taxCodes]);

  const productByCode = useMemo(
    () =>
      Object.fromEntries(
        products.map((p) => [
          p.code,
          {
            id: p.id,
            code: p.code,
            name: p.name,
            uom: p.uom,
            price: Number(p.salePrice),
            stock: p.availableQty,
            taxRate: taxRateOf(p),
          },
        ]),
      ),
    [products, taxRateOf],
  );

  // FIFO: open purchase lots per product (oldest first). The cart the rest of
  // the page uses is `rawCart` re-priced across those lots — each line's price
  // is the weighted average of the lots its qty will be taken from, so
  // qty x price matches what the server bills (it splits the line per lot).
  const { data: lotRows = [] } = useGetProductLotsQuery();
  const lotsByProduct = useMemo(() => groupLotsByProduct(lotRows), [lotRows]);
  const [rawCart, setCart] = useState([]);
  const cart = useMemo(
    () =>
      rawCart.map((line) => {
        const live = productByCode[line.code];
        // Each line is taxed at its own product's current GST rate.
        const taxed = live ? { ...line, taxRate: live.taxRate } : line;
        const lots = lotsByProduct.get(line.id);
        if (!lots || lots.length === 0) return taxed;
        const fallback = live?.price ?? line.price;
        return { ...taxed, price: fifoAveragePrice(lots, line.qty, fallback) };
      }),
    [rawCart, lotsByProduct, productByCode],
  );
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("amount");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [printSettingsEnabled, setPrintSettingsEnabled] = useState(false);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [customer, setCustomer] = useState(WALK_IN_CUSTOMER);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  // 'billing' = items + cart; 'payment' = customer details, payment methods,
  // Pay & Print. Both are views of this one page so the in-progress cart,
  // customer and discount carry over without being lifted into the store.
  const [step, setStep] = useState("billing");
  // The held bill whose contents are currently on screen (set by Resume,
  // cleared by Hold/Pay/Clear). While set, Hold updates that same bill
  // instead of creating a second one, and Pay closes it out atomically.
  const [activeHeldBill, setActiveHeldBill] = useState(null);
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  // A held bill the cashier tapped Resume on while another unsaved bill is
  // still on screen — drives the "hold or clear it first" prompt.
  const [pendingResume, setPendingResume] = useState(null);
  // Item picker popup — see handleAddItem / ItemChoiceDialog.
  const [itemChoice, setItemChoice] = useState(null);
  const [busyHeldId, setBusyHeldId] = useState(null);
  // Idempotency token for one "hold new bill" attempt: reused if the request
  // is retried after a network failure so the server can't create two bills.
  const holdTokenRef = useRef(null);
  // Idempotency token for one "Pay & Print" attempt. It is reused when the
  // exact same bill is submitted again (lost response, double tap) so the
  // server returns the bill it already saved instead of billing twice, and is
  // replaced as soon as anything being paid changes (see handlePayAndPrint).
  const payAttemptRef = useRef({ signature: null, token: null });

  // Full-screen mode: the browser goes full screen (Fullscreen API) and this
  // page is lifted into a fixed overlay covering the viewport, so the app
  // shell (sidebar / top bar / tabs) is hidden. The overlay — rather than
  // fullscreening just this element — keeps MUI dialogs, menus and toasts
  // (rendered in portals on <body>) visible. Esc is handled by the browser
  // itself; we only listen for the change to show the notification.
  const [isFullScreen, setIsFullScreen] = useState(false);

  const enterFullScreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      dispatch(
        showToast("Full screen is not available in this browser", "warning"),
      );
    }
  }, [dispatch]);
  const exitFullScreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullScreen(active);
      // Short-lived and without a close button — it's just a confirmation.
      dispatch(
        showToast(
          active
            ? "Full screen mode — press Esc to exit"
            : "Exited full screen — back to normal view",
          "info",
          { duration: 1800, closable: false },
        ),
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
    };
  }, [dispatch]);

  // Space enters full screen — but only when nothing is being typed into or
  // focused (inputs, buttons, links, dialogs), otherwise it would swallow
  // spaces in search/discount fields and double-fire buttons. Tab is left
  // alone on purpose: it's keyboard focus navigation. The header button
  // works in every situation.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.code !== "Space" ||
        e.repeat ||
        document.fullscreenElement ||
        addCustomerOpen
      )
        return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable ||
          el.closest(
            'input, textarea, select, button, a, [role="button"], [role="menuitem"], [role="dialog"]',
          ))
      )
        return;
      e.preventDefault();
      enterFullScreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addCustomerOpen, enterFullScreen]);

  // Auto-generated by the backend (see api/saleApi's NextBillNo query and
  // backend/src/modules/sale's nextBillNo) — never typed or edited here.
  // Distinguishes "still loading" from "the request failed" so a stuck
  // dash is actually diagnosable instead of looking like a static value.
  const billNo = isLoadingBillNo
    ? "Generating…"
    : billNoError
      ? "Unavailable"
      : previewBillNo || "—";
  // Bill date/time. It used to be computed once when the page opened, so it
  // went stale (and printed the wrong time). It now ticks with the clock for
  // the on-screen header, and printing always re-reads the current time.
  const formatBillDateTime = (value = new Date()) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const dateTime = formatBillDateTime(now);

  // Rounded to paise before being compared anywhere (the "Exact" chip sets
  // receivedAmount to this same rounded value) — without this, grandTotal's
  // raw floating-point sum could sit a fraction of a paise off from the
  // amount the chip actually fills in, leaving changeAmount very slightly
  // negative and wrongly flashing the "Amount short" red state even when
  // the cashier paid the exact bill total.
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const totals = useMemo(() => {
    const subTotal = cart.reduce((sum, line) => sum + line.qty * line.price, 0);
    const discountAmount =
      discountType === "percent"
        ? (subTotal * discount) / 100
        : Math.min(discount, subTotal);
    const taxable = Math.max(subTotal - discountAmount, 0);
    const tax = cart.reduce((sum, line) => {
      const lineTaxable =
        subTotal > 0 ? ((line.qty * line.price) / subTotal) * taxable : 0;
      return sum + lineTaxable * line.taxRate;
    }, 0);
    const grandTotal = round2(taxable + tax);
    // GST broken out per rate (one row per distinct rate on the bill).
    const byRate = new Map();
    cart.forEach((line) => {
      const lineTaxable = subTotal > 0 ? ((line.qty * line.price) / subTotal) * taxable : 0;
      const g = byRate.get(line.taxRate) || { rate: line.taxRate, taxable: 0, tax: 0 };
      g.taxable += lineTaxable;
      g.tax += lineTaxable * line.taxRate;
      byRate.set(line.taxRate, g);
    });
    const taxGroups = [...byRate.values()]
      .sort((a, b) => a.rate - b.rate)
      .map((g) => ({ rate: g.rate, taxable: round2(g.taxable), tax: round2(g.tax) }));
    return { subTotal: round2(subTotal), discountAmount: round2(discountAmount), taxable: round2(taxable), tax: round2(tax), grandTotal, taxGroups };
  }, [cart, discount, discountType]);

  const totalQty = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart]);

  const changeAmount = round2(receivedAmount - totals.grandTotal);

  // Entry point for every "add this item" (search, scan, Short ID). When the
  // pick is ambiguous — other active products share its name, or it has 2+
  // open stock lots — a popup lists the candidates (with stock and lots) so
  // the cashier chooses; otherwise the item goes straight onto the bill.
  const handleAddItem = (code) => {
    const item = productByCode[code];
    if (!item) return;
    const nameKey = String(item.name || "").trim().toLowerCase();
    const siblings = products.filter(
      (p) => String(p.name || "").trim().toLowerCase() === nameKey,
    );
    const lotsOf = (p) => lotsByProduct.get(p.id) || [];
    const ambiguous = siblings.length >= 2 || lotsOf(item).length >= 2;
    if (!ambiguous) {
      addItemToCart(code);
      return;
    }
    const ordered = [
      ...siblings.filter((p) => p.code === code),
      ...siblings.filter((p) => p.code !== code),
    ];
    setItemChoice({
      name: item.name,
      pickedCode: code,
      candidates: ordered.map((p) => ({ product: p, lots: lotsOf(p) })),
    });
  };

  const addItemToCart = (code) => {
    const item = productByCode[code];
    if (!item) return;

    setCart((prev) => {
      const existing = prev.find((line) => line.code === code);
      const nextQty = (existing?.qty || 0) + 1;
      // No stock validation — items can be sold even when stock is 0.
      if (existing) {
        return prev.map((line) =>
          line.code === code ? { ...line, qty: nextQty } : line,
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          code,
          qty: 1,
          name: item.name,
          uom: item.uom,
          price: item.price,
          taxRate: item.taxRate,
        },
      ];
    });
  };

  // Swap one cart line's item for another (the line's own search cell). The
  // quantity carries over, capped at the new item's stock; if the new item is
  // already on another line the two lines are merged.
  const handleReplaceItem = (oldCode, newCode) => {
    if (oldCode === newCode) return;
    const item = productByCode[newCode];
    if (!item) return;
    setCart((prev) => {
      const old = prev.find((line) => line.code === oldCode);
      if (!old) return prev;
      const dup = prev.find((line) => line.code === newCode);
      if (dup) {
        const merged = dup.qty + old.qty;
        return prev
          .filter((line) => line.code !== oldCode)
          .map((line) => (line.code === newCode ? { ...line, qty: merged } : line));
      }
      return prev.map((line) =>
        line.code === oldCode
          ? {
              id: item.id,
              code: newCode,
              qty: old.qty,
              name: item.name,
              uom: item.uom,
              price: item.price,
              taxRate: item.taxRate,
            }
          : line,
      );
    });
  };

  const handleQtyChange = (code, qty) => {
    const item = productByCode[code];
    // Stock is not enforced — only keep qty at 1 or more.
    const clamped = Math.max(1, qty);
    setCart((prev) =>
      prev.map((line) =>
        line.code === code ? { ...line, qty: clamped } : line,
      ),
    );
  };

  const handleRemove = (code) => {
    setCart((prev) => prev.filter((line) => line.code !== code));
  };

  const resetBill = () => {
    setCart([]);
    setDiscount(0);
    setDiscountType("amount");
    setReceivedAmount(0);
    setCustomer(WALK_IN_CUSTOMER);
    setActiveHeldBill(null);
    holdTokenRef.current = null;
    payAttemptRef.current = { signature: null, token: null };
  };
  const handleClear = () => {
    const parked = activeHeldBill;
    resetBill();
    setStep("billing");
    dispatch(
      showToast(
        parked
          ? `Cart cleared — ${parked.reference} is still saved under Held Bills`
          : "Cart cleared",
        "info",
      ),
    );
  };

  // ---- Hold / Resume ------------------------------------------------------
  const newHoldToken = () =>
    globalThis.crypto?.randomUUID?.() ??
    `hb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const errorMessage = (err, fallback) =>
    err?.status === "FETCH_ERROR"
      ? "Couldn\u2019t reach the server \u2014 nothing was changed. Check the connection and try again."
      : err?.data?.message || fallback;

  // Saves the current cart as a held bill: a new one, or — when this cart
  // was resumed from one — an in-place update of that same bill. Returns the
  // saved bill, or null on any failure (the cart is left untouched so the
  // cashier loses nothing).
  const holdCurrentBill = async () => {
    if (cart.length === 0) {
      dispatch(
        showToast("Add at least one item before holding the bill", "warning"),
      );
      return null;
    }
    if (discountType === "percent" && discount > 100) {
      dispatch(showToast("Percentage discount cannot exceed 100", "warning"));
      return null;
    }
    const payload = {
      customerId:
        customer.id && customer.id !== WALK_IN_CUSTOMER.id
          ? customer.id
          : undefined,
      customerName: customer.name,
      lines: cart.map((line) => ({ productId: line.id, qty: line.qty })),
      discountType,
      discountValue: discount,
    };
    try {
      if (activeHeldBill)
        return await updateHeldBill({
          id: activeHeldBill.id,
          ...payload,
        }).unwrap();
      if (!holdTokenRef.current) holdTokenRef.current = newHoldToken();
      return await holdBill({
        ...payload,
        clientToken: holdTokenRef.current,
      }).unwrap();
    } catch (err) {
      dispatch(
        showToast(
          errorMessage(
            err,
            "Failed to hold the bill \u2014 your bill is still on screen",
          ),
          "error",
        ),
      );
      return null;
    }
  };

  const handleHoldBill = async () => {
    const saved = await holdCurrentBill();
    if (!saved) return;
    resetBill();
    setStep("billing");
    dispatch(
      showToast(
        `Bill held as ${saved.reference}. Resume it from Held Bills.`,
        "success",
      ),
    );
  };

  // Puts a resumed bill's saved lines, UOMs, prices, discount, tax basis and
  // customer back on the billing screen.
  const loadHeldBill = (bill) => {
    setCart(
      bill.lines.map((line) => ({
        id: line.productId,
        code: line.code,
        qty: line.qty,
        name: line.name,
        uom: line.uom,
        price: line.price,
        taxRate: line.taxRate,
      })),
    );
    setDiscountType(bill.discountType);
    setDiscount(bill.discountValue);
    setReceivedAmount(0);
    setCustomer(
      bill.customer || {
        ...WALK_IN_CUSTOMER,
        name: bill.customerName || WALK_IN_CUSTOMER.name,
      },
    );
    setActiveHeldBill({ id: bill.id, reference: bill.reference });
    holdTokenRef.current = null;
    setStep("billing");

    const changed = bill.lines.filter(
      (l) =>
        l.live &&
        (!l.live.active ||
          l.live.price !== l.price),
    );
    if (changed.length > 0) {
      dispatch(
        showToast(
          `${changed.length} item${changed.length === 1 ? "" : "s"} changed since this bill was held (price): ${changed
            .map((l) => l.name)
            .slice(0, 3)
            .join(
              ", ",
            )}${changed.length > 3 ? "\u2026" : ""}. Prices are re-checked when you pay.`,
          "warning",
        ),
      );
    }
  };

  const doResume = async (summary) => {
    setBusyHeldId(summary.id);
    try {
      const bill = await resumeHeldBill(summary.id).unwrap();
      loadHeldBill(bill);
      setHeldDialogOpen(false);
      dispatch(showToast(`Resumed ${bill.reference}`, "success"));
      return true;
    } catch (err) {
      dispatch(
        showToast(errorMessage(err, "Failed to resume the held bill"), "error"),
      );
      refetchHeld();
      return false;
    } finally {
      setBusyHeldId(null);
    }
  };

  // Never overwrites an unsaved cart silently: if items are on screen the
  // cashier must hold or clear them first.
  const handleResumeRequest = (summary) => {
    if (summary.id === activeHeldBill?.id) {
      setHeldDialogOpen(false);
      return;
    }
    if (cart.length > 0) {
      setPendingResume(summary);
      return;
    }
    doResume(summary);
  };
  const handleHoldThenResume = async () => {
    const target = pendingResume;
    const saved = await holdCurrentBill();
    if (!saved) return; // error toast already shown; keep the prompt and the cart
    resetBill();
    setPendingResume(null);
    dispatch(showToast(`Current bill held as ${saved.reference}`, "success"));
    await doResume(target);
  };
  const handleClearThenResume = async () => {
    const target = pendingResume;
    resetBill();
    setPendingResume(null);
    await doResume(target);
  };
  const handleDiscardHeld = async (summary) => {
    setBusyHeldId(summary.id);
    try {
      await discardHeldBill(summary.id).unwrap();
      // The bill on screen was resumed from this exact held bill — now that
      // it's deleted, drop the stale link so the header stops showing its
      // "· HB-000xx" tag and a later Hold Bill creates a fresh held bill
      // instead of trying to update one that no longer exists.
      if (summary.id === activeHeldBill?.id) setActiveHeldBill(null);
      dispatch(showToast(`${summary.reference} discarded`, "info"));
    } catch (err) {
      dispatch(
        showToast(
          errorMessage(err, "Failed to discard the held bill"),
          "error",
        ),
      );
      refetchHeld();
    } finally {
      setBusyHeldId(null);
    }
  };

  // Browsers' own "leave site?" prompt (not alert/confirm) so a refresh or
  // tab close doesn't silently throw away an unsaved cart. Held bills that
  // were already saved are unaffected — they live on the server.
  useEffect(() => {
    if (cart.length === 0) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [cart.length]);
  const handleMoreAction = (label) => {
    setMoreActionsAnchor(null);
    dispatch(showToast(`${label} is coming soon`, "info"));
  };
  const handleAddCustomer = () => setAddCustomerOpen(true);
  const handleSelectCustomer = (selected) => {
    setCustomer(selected);
    if (selected.name !== WALK_IN_CUSTOMER.name) {
      dispatch(showToast(`${selected.name} selected`, "info"));
    }
  };
  const handleCustomerCreated = (newCustomer) => {
    setCustomer(newCustomer);
    setAddCustomerOpen(false);
    dispatch(showToast("Customer saved successfully", "success"));
  };

  const handlePayAndPrint = async () => {
    if (cart.length === 0) {
      dispatch(
        showToast("Add at least one item before taking payment", "warning"),
      );
      return;
    }
    // Received amount is mandatory and must cover the bill (Credit sales
    // are the one method that is legitimately settled later).
    if (paymentMethod !== "credit") {
      if (!(Number(receivedAmount) > 0)) {
        dispatch(showToast("Received amount is required", "warning"));
        return;
      }
      if (changeAmount < 0) {
        dispatch(
          showToast(
            "Received amount cannot be less than the total amount",
            "warning",
          ),
        );
        return;
      }
    }

    const payload = {
      customerId:
        customer.id && customer.id !== WALK_IN_CUSTOMER.id
          ? customer.id
          : undefined,
      customerName: customer.name,
      cashierName,
      lines: cart.map((line) => ({ productId: line.id, qty: line.qty })),
      discountType,
      discountValue: discount,
      paymentMethod,
      receivedAmount,
      // Present only for a resumed bill: closes the held bill out in the
      // same server transaction as the sale (so it can't be paid twice).
      heldBillId: activeHeldBill?.id,
    };
    // Same bill as the previous attempt -> same token (a retry can't create a
    // second bill); anything changed -> a fresh token.
    const signature = JSON.stringify(payload);
    if (payAttemptRef.current.signature !== signature) {
      payAttemptRef.current = { signature, token: newHoldToken() };
    }

    try {
      const sale = await createSale({
        ...payload,
        clientToken: payAttemptRef.current.token,
      }).unwrap();

      dispatch(
        showToast(`Payment captured — Bill ${sale.billNo} saved`, "success"),
      );
      // Print the invoice for the saved sale (uses the cart/totals before
      // resetBill clears them).
      try {
        printReceipt({
          company: companyProfile,
          billNo: sale.billNo || billNo,
          cashierName,
          dateTime: formatBillDateTime(sale.createdAt || new Date()),
          cart,
          totals,
          paymentMethod,
          receivedAmount,
          changeAmount,
        });
      } catch {
        dispatch(showToast("Sale saved, but the invoice could not be printed", "warning"));
      }
      resetBill();
      setStep("billing");
    } catch (err) {
      dispatch(
        showToast(err?.data?.message || "Failed to save the sale", "error"),
      );
    }
  };
  const handleProceed = () => {
    if (cart.length === 0) {
      dispatch(showToast("Add at least one item before proceeding", "warning"));
      return;
    }
    setStep("payment");
  };
  const handleBackToBilling = () => setStep("billing");
  const handlePrintInvoice = () => {
    if (cart.length === 0) {
      dispatch(showToast("Add at least one item before printing", "warning"));
      return;
    }
    const opened = printReceipt({
      company: companyProfile,
      billNo,
      cashierName,
      dateTime: formatBillDateTime(new Date()),
      cart,
      totals,
      paymentMethod,
      receivedAmount,
      changeAmount,
    });
    if (!opened) {
      dispatch(showToast("Allow pop-ups for this site to print the invoice", "warning"));
    }
  };

  // Enter or F9 = Pay & Print, F10 = Print Invoice (payment step only). A ref keeps
  // the listener pointing at the latest handlers without re-binding.
  const shortcutRef = useRef({});
  shortcutRef.current = {
    step,
    pay: handlePayAndPrint,
    print: handlePrintInvoice,
    busy: isPaying,
    proceed: handleProceed,
    hasItems: cart.length > 0,
    blocked: addCustomerOpen,
  };
  // Enter on the billing step (search/barcode box empty, i.e. the product has
  // just been picked) = "Continue to Payment". Captured before the inputs'
  // own handlers so the Enter that selects a product never also proceeds.
  useEffect(() => {
    const onEnter = (e) => {
      if (e.key !== "Enter" || e.repeat) return;
      const s = shortcutRef.current;
      // Payment step: Enter = Pay & Print (same as F9). Ignored while a
      // dialog/dropdown is open, on a focused button/link (Enter already
      // activates that), or while a payment is already in flight.
      if (s.step === "payment") {
        if (s.blocked || s.busy) return;
        const target = e.target;
        if (
          target instanceof HTMLElement &&
          target.closest(
            '[role="dialog"], [role="listbox"], [role="menu"], button, a, textarea, [role="combobox"]',
          )
        )
          return;
        e.preventDefault();
        s.pay();
        return;
      }
      if (s.step !== "billing" || !s.hasItems || s.blocked) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.closest('[role="dialog"], [role="listbox"], button, a, textarea'))
        return;
      if (el.tagName === "INPUT") {
        if (el.value !== "") return;
        if (el.getAttribute("aria-expanded") === "true") return;
      } else if (el !== document.body) return;
      e.preventDefault();
      s.proceed();
    };
    window.addEventListener("keydown", onEnter, true);
    return () => window.removeEventListener("keydown", onEnter, true);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "F9" && e.key !== "F10") return;
      const s = shortcutRef.current;
      if (s.step !== "payment") return;
      e.preventDefault();
      if (e.repeat) return;
      if (e.key === "F9") {
        if (!s.busy) s.pay();
      } else {
        s.print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Stack
      spacing={2}
      sx={
        isFullScreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: (t) => t.zIndex.modal - 1,
              bgcolor: "background.default",
              overflow: "auto",
              p: { xs: 1.5, md: 2.5 },
            }
          : undefined
      }
    >
      {isFullScreen && (
        <Box sx={{ alignSelf: "flex-start" }}>
          <AppLogo iconSize={32} />
        </Box>
      )}
      {step === "billing" ? (
        <Stack direction="row" spacing={2} sx={{ alignItems: "stretch" }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexShrink: 0 }}>
            <ShoppingCartOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
              Line Sales
            </Typography>
          </Stack>
          <LineSaleTopBar
            billNo={
              activeHeldBill
                ? `${billNo} \u00b7 ${activeHeldBill.reference}`
                : billNo
            }
            billStatus="Draft"
            cashierName={cashierName}
            dateTime={dateTime}
            isFullScreen={isFullScreen}
            onEnterFullScreen={enterFullScreen}
            onExitFullScreen={exitFullScreen}
            onHoldBill={handleHoldBill}
            isHolding={isHolding || isUpdatingHeld || isResuming}
            heldCount={heldBills.length}
            onOpenHeld={() => setHeldDialogOpen(true)}
            onClear={handleClear}
            moreActionsAnchor={moreActionsAnchor}
            onOpenMoreActions={(e) => setMoreActionsAnchor(e.currentTarget)}
            onCloseMoreActions={() => setMoreActionsAnchor(null)}
            onMoreAction={handleMoreAction}
          />
        </Stack>
      ) : (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Line Sale — Payment
            </Typography>
            <Breadcrumbs
              separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
              sx={{
                "& .MuiTypography-root, & .MuiLink-root": { fontSize: 12.5 },
              }}
            >
              <MuiLink
                component={RouterLink}
                to="/home"
                underline="hover"
                color="text.secondary"
              >
                Home
              </MuiLink>
              <MuiLink
                component="button"
                type="button"
                underline="hover"
                color="text.secondary"
                onClick={handleBackToBilling}
              >
                Line Sale
              </MuiLink>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Payment
              </Typography>
            </Breadcrumbs>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip
              title={
                isFullScreen ? "Exit full screen (Esc)" : "Full screen (Space)"
              }
            >
              <IconButton
                onClick={isFullScreen ? exitFullScreen : enterFullScreen}
                aria-label={
                  isFullScreen ? "Exit full screen" : "Enter full screen"
                }
              >
                {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
            <Badge badgeContent={heldBills.length} color="warning" max={99}>
              <ButtonGroup
                variant="outlined"
                color="warning"
                sx={{ "& .MuiButtonGroup-grouped": { minHeight: 44 } }}
              >
                <Button
                  startIcon={<PauseCircleOutlineIcon />}
                  onClick={handleHoldBill}
                  disabled={isHolding || isUpdatingHeld || isResuming}
                >
                  {isHolding || isUpdatingHeld ? "Holding\u2026" : "Hold Bill"}
                </Button>
                <Tooltip title="View held bills">
                  <Button onClick={() => setHeldDialogOpen(true)} sx={{ px: 1.25 }}>
                    <FolderOpenOutlinedIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </Badge>
            <Button variant="outlined" color="error" onClick={handleClear}>
              Clear
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              endIcon={<ExpandMoreIcon />}
              onClick={(e) => setMoreActionsAnchor(e.currentTarget)}
            >
              More Actions
            </Button>
            <Menu
              anchorEl={moreActionsAnchor}
              open={Boolean(moreActionsAnchor)}
              onClose={() => setMoreActionsAnchor(null)}
            >
              <MenuItem onClick={() => handleMoreAction("Apply Promotion")}>
                Apply Promotion
              </MenuItem>
              <MenuItem onClick={() => handleMoreAction("Redeem Voucher")}>
                Redeem Voucher
              </MenuItem>
              <MenuItem onClick={() => handleMoreAction("Void Sale")}>
                Void Sale
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      )}

      {step === "billing" ? (
        <>
          <CustomerSearchBar
            customer={customer}
            onSelectCustomer={handleSelectCustomer}
            onAddCustomer={handleAddCustomer}
          />

          <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Box sx={{ height: { lg: 560 } }}>
                <CurrentSaleTable
                  lines={cart}
                  onQtyChange={handleQtyChange}
                  onRemove={handleRemove}
                  products={counterProducts}
                  counters={itemGroups.map((g) => g.name)}
                  counter={counter}
                  onCounterChange={setCounter}
                  onAddItem={handleAddItem}
                  onReplaceItem={handleReplaceItem}
                  onNotify={(message, severity) => dispatch(showToast(message, severity))}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <BillSummaryPanel
                billStatus="Draft"
                itemCount={cart.length}
                qtyCount={totalQty}
                discount={discount}
                discountType={discountType}
                onDiscountChange={setDiscount}
                onDiscountTypeChange={setDiscountType}
                totals={totals}
                onProceed={handleProceed}
                disabled={cart.length === 0}
              />
            </Grid>
          </Grid>
        </>
      ) : (
        <>
          <StepProgress current={1} />

          <BillInfoCard
            billNo={
              activeHeldBill
                ? `${billNo} \u00b7 ${activeHeldBill.reference}`
                : billNo
            }
            cashierName={cashierName}
            dateTime={dateTime}
          />

          <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={2}>
                <PaymentMethodsCard
                  methods={PAYMENT_METHODS}
                  selectedMethod={paymentMethod}
                  onSelectMethod={setPaymentMethod}
                  receivedAmount={receivedAmount}
                  onReceivedAmountChange={setReceivedAmount}
                  quickAmounts={QUICK_AMOUNTS}
                  exactAmount={totals.grandTotal}
                  changeAmount={changeAmount}
                />
                <CustomerDetailsCard
                  customer={customer}
                  onAddCustomer={handleAddCustomer}
                />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={2}>
                <AmountPayableCard
                  billNo={billNo}
                  lines={cart}
                  totals={totals}
                />
                <PaymentActionsCard
                  onPayAndPrint={handlePayAndPrint}
                  onPrintInvoice={handlePrintInvoice}
                  onBack={handleBackToBilling}
                  printSettingsEnabled={printSettingsEnabled}
                  onTogglePrintSettings={setPrintSettingsEnabled}
                  disabled={cart.length === 0 || isPaying}
                />
              </Stack>
            </Grid>
          </Grid>
        </>
      )}

      <HeldBillsDialog
        open={heldDialogOpen}
        onClose={() => setHeldDialogOpen(false)}
        bills={heldBills}
        isLoading={isLoadingHeld}
        isFetching={isFetchingHeld}
        isError={heldError}
        onRefresh={refetchHeld}
        activeBillId={activeHeldBill?.id}
        busyBillId={busyHeldId}
        onResume={handleResumeRequest}
        onDiscard={handleDiscardHeld}
      />

      <Dialog
        open={Boolean(pendingResume)}
        onClose={() => setPendingResume(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Current bill has items
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            The screen has an unsaved bill ({cart.length} item
            {cart.length === 1 ? "" : "s"},{" "}
            {formatCurrency(totals.grandTotal, { decimals: true })}). Hold it,
            or clear it, before resuming {pendingResume?.reference}.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button
            color="inherit"
            onClick={() => setPendingResume(null)}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={handleClearThenResume}
            disabled={isHolding || isUpdatingHeld}
            sx={{ minHeight: 44 }}
          >
            Clear &amp; Resume
          </Button>
          <Button
            variant="contained"
            onClick={handleHoldThenResume}
            disabled={isHolding || isUpdatingHeld}
            sx={{ minHeight: 44 }}
          >
            {isHolding || isUpdatingHeld
              ? "Holding\u2026"
              : "Hold Current & Resume"}
          </Button>
        </DialogActions>
      </Dialog>

      <ItemChoiceDialog
        choice={itemChoice}
        onClose={() => setItemChoice(null)}
        onPick={(code) => {
          setItemChoice(null);
          addItemToCart(code);
        }}
      />

      <AddCustomerDialog
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </Stack>
  );
}
