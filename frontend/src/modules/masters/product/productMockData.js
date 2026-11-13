/**
 * TEMPORARY mock data for the Product master. There's no Product backend
 * module yet, so this static snapshot stands in for
 * `useGetProductsQuery()`. Replace with real API data once that module
 * exists — do not add more mock data here in the meantime. `totalRecords`
 * is kept separate from `PRODUCTS.length` since only the first page of a
 * 245-record catalog is mocked here.
 */

export const STATS = {
  totalProducts: 245,
  activeProducts: 232,
  inactiveProducts: 13,
  lowStockProducts: 18,
  outOfStockProducts: 5,
  totalInventoryValue: 1245678.50,
};

export const PRODUCT_GROUP_OPTIONS = ['Grocery', 'Edible Oil', 'Dairy Products', 'Flour', 'Personal Care', 'Beverages', 'Snacks'];
export const PRODUCT_TYPE_OPTIONS = ['Finished Goods', 'Raw Material', 'Semi-Finished'];
export const BRAND_OPTIONS = ['India Gate', 'Sunpure', 'Amul', 'Aashirvaad', 'Premium', 'Lux', 'Clinic Plus', 'Tata Tea', 'Parle', 'Coca Cola'];
export const UOM_OPTIONS = ['PCS', 'KG', 'LTR', 'BOX'];
export const PRODUCT_SUB_GROUP_OPTIONS = ['General', 'Premium', 'Economy', 'Combo Pack'];
export const MANAGE_ITEM_BY_OPTIONS = ['None', 'Serial Numbers', 'Batches'];
export const MANAGE_METHOD_OPTIONS = ['On Every Transaction', 'Single in Document', 'No Management'];
export const SHIPPING_TYPE_OPTIONS = ['Standard', 'Express', 'Fragile', 'Cold Chain'];
export const TAX_GROUP_OPTIONS = ['Taxable', 'Exempt', 'Zero Rated', 'Nil Rated'];

export const PRODUCT_GROUP_COLORS = {
  Grocery: '#F5A623',
  'Edible Oil': '#F2C40C',
  'Dairy Products': '#2563EB',
  Flour: '#C1560A',
  'Personal Care': '#22A06B',
  Beverages: '#E5484D',
  Snacks: '#8B5CF6',
};

export const totalRecords = 245;
export const totalPages = 25;

export const PRODUCTS = [
  { code: 'PROD0001', name: 'India Gate Basmati Rice 5kg', group: 'Grocery', brand: 'India Gate', uom: 'PCS', hsnSac: '10063010', taxCode: 'GST 5%', salePrice: 550.00, mrp: 600.00, availableQty: 125, status: 'Active' },
  { code: 'PROD0002', name: 'Sunflower Oil 1 Ltr', group: 'Edible Oil', brand: 'Sunpure', uom: 'PCS', hsnSac: '15121100', taxCode: 'GST 5%', salePrice: 135.00, mrp: 150.00, availableQty: 200, status: 'Active' },
  { code: 'PROD0003', name: 'Amul Toned Milk 1 Ltr', group: 'Dairy Products', brand: 'Amul', uom: 'PCS', hsnSac: '04012010', taxCode: 'GST 0%', salePrice: 56.00, mrp: 56.00, availableQty: 150, status: 'Active' },
  { code: 'PROD0004', name: 'Aashirvaad Atta 5kg', group: 'Flour', brand: 'Aashirvaad', uom: 'PCS', hsnSac: '11010010', taxCode: 'GST 5%', salePrice: 165.00, mrp: 175.00, availableQty: 98, status: 'Active' },
  { code: 'PROD0005', name: 'Sugar 1kg', group: 'Grocery', brand: 'Premium', uom: 'PCS', hsnSac: '17019910', taxCode: 'GST 5%', salePrice: 46.00, mrp: 50.00, availableQty: 300, status: 'Active' },
  { code: 'PROD0006', name: 'Lux Soap 125g', group: 'Personal Care', brand: 'Lux', uom: 'PCS', hsnSac: '34011110', taxCode: 'GST 18%', salePrice: 38.00, mrp: 45.00, availableQty: 250, status: 'Active' },
  { code: 'PROD0007', name: 'Clinic Plus Shampoo 175ml', group: 'Personal Care', brand: 'Clinic Plus', uom: 'PCS', hsnSac: '33051000', taxCode: 'GST 18%', salePrice: 122.00, mrp: 140.00, availableQty: 120, status: 'Active' },
  { code: 'PROD0008', name: 'Tata Tea Premium 250g', group: 'Beverages', brand: 'Tata Tea', uom: 'PCS', hsnSac: '09021010', taxCode: 'GST 5%', salePrice: 112.00, mrp: 125.00, availableQty: 75, status: 'Active' },
  { code: 'PROD0009', name: 'Parle-G Biscuit 200g', group: 'Snacks', brand: 'Parle', uom: 'PCS', hsnSac: '19053100', taxCode: 'GST 18%', salePrice: 20.00, mrp: 25.00, availableQty: 400, status: 'Active' },
  { code: 'PROD0010', name: 'Coca Cola 750ml', group: 'Beverages', brand: 'Coca Cola', uom: 'PCS', hsnSac: '22021010', taxCode: 'GST 28%', salePrice: 55.00, mrp: 65.00, availableQty: 180, status: 'Active' },
];
