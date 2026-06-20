import { ProductForm } from "@/components/admin/ProductForm";
import { getCategories } from "@/lib/queries";
import { createProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await getCategories();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm action={createProduct} categories={categories} />
    </div>
  );
}
