"use client";

import { useState } from "react";

type Variant = { id?: string; label: string; priceDollars: string; stock: string };
type Image = { url: string; alt: string };

export type ProductFormData = {
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  active: boolean;
  featured: boolean;
  variants: Variant[];
  images: Image[];
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categories: { id: string; name: string }[];
  initial?: ProductFormData;
};

const emptyVariant: Variant = { label: "", priceDollars: "", stock: "0" };

export function ProductForm({ action, categories, initial }: Props) {
  const [variants, setVariants] = useState<Variant[]>(
    initial?.variants?.length ? initial.variants : [{ ...emptyVariant, label: "Default" }],
  );
  const [images, setImages] = useState<Image[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        setImages((prev) => [...prev, { url: data.url, alt: "" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Serialize complex fields just before the server action runs.
  function enrich(formData: FormData) {
    formData.set(
      "variants",
      JSON.stringify(
        variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          label: v.label.trim() || "Default",
          priceCents: Math.round(parseFloat(v.priceDollars || "0") * 100),
          stock: parseInt(v.stock || "0", 10),
        })),
      ),
    );
    formData.set("images", JSON.stringify(images));
    return action(formData);
  }

  return (
    <form action={enrich} className="max-w-2xl space-y-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={initial?.name}
          className="input"
        />
      </Field>

      <Field label="Slug (URL) — leave blank to auto-generate">
        <input name="slug" defaultValue={initial?.slug} className="input" />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          className="input"
        />
      </Field>

      <Field label="Category">
        <select
          name="categoryId"
          defaultValue={initial?.categoryId ?? ""}
          className="input"
        >
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
          Active (visible in shop)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? false} />
          Featured on home
        </label>
      </div>

      {/* Images */}
      <div>
        <p className="mb-2 text-sm font-medium">Images</p>
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={img.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="h-20 w-20 rounded border border-stone-200 object-cover"
              />
              <button
                type="button"
                onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-stone-300 text-2xl text-stone-400 hover:border-stone-500">
            +
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
        {uploading && <p className="mt-1 text-sm text-stone-500">Uploading…</p>}
      </div>

      {/* Variants */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Variants / options</p>
          <button
            type="button"
            onClick={() => setVariants((p) => [...p, { ...emptyVariant }])}
            className="text-sm text-stone-600 underline"
          >
            + Add variant
          </button>
        </div>
        <div className="space-y-2 overflow-x-auto">
          <div className="grid min-w-[26rem] grid-cols-[1fr_100px_80px_32px] gap-2 text-xs text-stone-500">
            <span>Label</span>
            <span>Price ($)</span>
            <span>Stock</span>
            <span />
          </div>
          {variants.map((v, i) => (
            <div key={i} className="grid min-w-[26rem] grid-cols-[1fr_100px_80px_32px] gap-2">
              <input
                value={v.label}
                onChange={(e) =>
                  setVariants((p) =>
                    p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                placeholder="e.g. Large / Blue"
                className="input"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={v.priceDollars}
                onChange={(e) =>
                  setVariants((p) =>
                    p.map((x, j) => (j === i ? { ...x, priceDollars: e.target.value } : x)),
                  )
                }
                className="input"
              />
              <input
                type="number"
                min="0"
                value={v.stock}
                onChange={(e) =>
                  setVariants((p) =>
                    p.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)),
                  )
                }
                className="input"
              />
              <button
                type="button"
                disabled={variants.length === 1}
                onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}
                className="text-stone-400 hover:text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-700"
      >
        Save product
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
