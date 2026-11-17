import { useState } from 'react';

import BarcodeLabelOverviewPage from './BarcodeLabelOverviewPage';
import BarcodeLabelStatusPage from './BarcodeLabelStatusPage';
import CreateBarcodeLabelPage from './CreateBarcodeLabelPage';
import BarcodeLabelViewPage from './BarcodeLabelViewPage';
import BarcodeHistoryPage from './BarcodeHistoryPage';

/**
 * Landing page for the sidebar's Barcode & Label item — a single page that
 * hosts the list (All/Draft/Pending Print/Printed), the create/edit form,
 * and the read-only view, all swapped in place via local state instead of
 * separate /create, /edit/:id, /view/:id routes. Clicking "New Barcode &
 * Label", a row's "View", or a row's "Edit" just swaps which body renders
 * here — the browser stays on /barcode-label throughout. Mirrors
 * SalesOrderPage/SalesInvoicePage.
 */
export default function BarcodeLabelPage() {
  const [tab, setTab] = useState('all');
  const [activeId, setActiveId] = useState(null);

  const goToList = () => {
    setActiveId(null);
    setTab('all');
  };
  const openCreate = () => {
    setActiveId(null);
    setTab('create');
  };
  const openEdit = (id) => {
    setActiveId(id);
    setTab('edit');
  };
  const openView = (id) => {
    setActiveId(id);
    setTab('view');
  };

  if (tab === 'create' || tab === 'edit') {
    return (
      <CreateBarcodeLabelPage
        id={tab === 'edit' ? activeId : undefined}
        onBack={(savedId) => (tab === 'edit' ? openView(savedId || activeId) : goToList())}
      />
    );
  }

  if (tab === 'view') {
    return <BarcodeLabelViewPage id={activeId} onBack={goToList} onEdit={() => openEdit(activeId)} />;
  }

  if (tab === 'history') {
    return <BarcodeHistoryPage onBack={goToList} />;
  }

  if (tab === 'all') {
    return (
      <BarcodeLabelOverviewPage
        tab={tab}
        onTabChange={setTab}
        onCreate={openCreate}
        onView={openView}
        onEdit={openEdit}
      />
    );
  }

  return (
    <BarcodeLabelStatusPage
      status={tab}
      tab={tab}
      onTabChange={setTab}
      onCreate={openCreate}
      onView={openView}
      onEdit={openEdit}
    />
  );
}
