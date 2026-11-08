'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX, ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, type FieldError, type Resolver, useForm, useWatch } from 'react-hook-form';

import { FormAlert, FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { type CategorySlug, SPEC_FIELDS } from '@/lib/parts/spec-fields';
import { type PartFormValues, partInputSchema } from '@/lib/validators/parts';
import { uploadPartImage, upsertPart } from '@/server/actions/admin-parts';

type Brand = { id: number; name: string };

export function PartForm({
  category,
  brands,
  initial,
}: {
  category: CategorySlug;
  brands: Brand[];
  initial?: PartFormValues;
}) {
  const router = useRouter();
  const fields = SPEC_FIELDS[category];
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PartFormValues>({
    // Zod แปลงข้อความในฟอร์มเป็นตัวเลขและรายการ ชนิดข้อมูลก่อนและหลังตรวจจึงไม่เหมือนกัน
    resolver: zodResolver(partInputSchema) as unknown as Resolver<PartFormValues>,
    defaultValues: initial ?? {
      categorySlug: category,
      brandId: '',
      model: '',
      price: '',
      powerWatt: '',
      releaseYear: '',
      imageUrl: '',
      specSourceUrl: '',
      specVerified: false,
      isActive: true,
      availability: 'new',
      spec: Object.fromEntries(fields.map((f) => [f.key, f.kind === 'bool' ? false : ''])),
    },
  });

  const imageUrl = useWatch({ control, name: 'imageUrl' });
  const usedOnly = useWatch({ control, name: 'availability' }) === 'used_only';

  async function onSubmit(values: PartFormValues) {
    setFormError(null);
    const result = await upsertPart(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push('/admin/parts');
    router.refresh();
  }

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError(null);
    const data = new FormData();
    data.set('file', file);
    const result = await uploadPartImage(data);
    if (result.ok) setValue('imageUrl', result.url, { shouldDirty: true });
    else setFormError(result.error);
    setUploading(false);
    event.target.value = '';
  }

  const specError = (key: string) => (errors.spec?.[key] as FieldError | undefined)?.message;

  return (
    <form
      method="post"
      className="flex max-w-3xl flex-col gap-4"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      {formError ? (
        <FormAlert variant="err" icon={<CircleX />}>
          {formError}
        </FormAlert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลกลาง</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField id="brandId" label="ยี่ห้อ" error={errors.brandId?.message}>
            <NativeSelect
              id="brandId"
              aria-invalid={Boolean(errors.brandId)}
              {...register('brandId')}
            >
              <option value="">เลือกยี่ห้อ</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="model" label="ชื่อรุ่น" error={errors.model?.message}>
            <Input id="model" aria-invalid={Boolean(errors.model)} {...register('model')} />
          </FormField>
          <FormField
            id="availability"
            label="สถานะการขาย"
            hint="รุ่นที่เลิกขายมือหนึ่งแล้ว ผู้ใช้จะได้เป็นมือสองเสมอ และระบบจัดตามงบใช้เฉพาะตอนผู้ใช้ยอมมือสอง"
          >
            <NativeSelect id="availability" {...register('availability')}>
              <option value="new">มีขายมือหนึ่ง</option>
              <option value="used_only">มีแต่มือสอง (เลิกขายมือหนึ่งแล้ว)</option>
            </NativeSelect>
          </FormField>
          <FormField
            id="price"
            label={usedOnly ? 'ราคาตอนเปิดตัว (บาท)' : 'ราคาอ้างอิง (บาท)'}
            error={errors.price?.message}
            hint={
              usedOnly
                ? 'ใช้คำนวณราคามือสองแบบประมาณการเท่านั้น ไม่แสดงเป็นราคาที่ซื้อได้'
                : undefined
            }
          >
            <Input
              id="price"
              inputMode="decimal"
              className="font-mono"
              aria-invalid={Boolean(errors.price)}
              {...register('price')}
            />
          </FormField>
          <FormField
            id="releaseYear"
            label="ปีที่วางขาย (ค.ศ.)"
            error={errors.releaseYear?.message}
            hint="ใช้คำนวณราคาประมาณการมือสอง"
          >
            <Input
              id="releaseYear"
              inputMode="numeric"
              className="font-mono"
              aria-invalid={Boolean(errors.releaseYear)}
              {...register('releaseYear')}
            />
          </FormField>
          {category === 'motherboard' ? (
            <FormField
              id="powerWatt"
              label="วัตต์ของบอร์ด (W)"
              error={errors.powerWatt?.message}
              hint="บอร์ดทั่วไป 50 ชิปเซ็ตระดับสูง 80 (หัวข้อ 4.3)"
            >
              <Input
                id="powerWatt"
                inputMode="numeric"
                className="font-mono"
                aria-invalid={Boolean(errors.powerWatt)}
                {...register('powerWatt')}
              />
            </FormField>
          ) : null}
          <FormField
            id="specSourceUrl"
            label="แหล่งอ้างอิงสเปก"
            error={errors.specSourceUrl?.message}
            hint="ลิงก์หน้าสเปกจากผู้ผลิต"
          >
            <Input
              id="specSourceUrl"
              type="url"
              aria-invalid={Boolean(errors.specSourceUrl)}
              {...register('specSourceUrl')}
            />
          </FormField>

          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-medium">รูปอะไหล่</span>
            <div className="flex flex-wrap items-center gap-3">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="รูปอะไหล่"
                  width={80}
                  height={80}
                  unoptimized
                  className="size-20 rounded-md border border-border object-contain"
                />
              ) : (
                <span className="grid size-20 place-items-center rounded-md bg-surface-2 text-subtle">
                  <ImagePlus aria-hidden className="size-6" />
                </span>
              )}
              <label className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-input bg-surface px-3 text-xs font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-surface-2">
                {uploading ? 'กำลังอัปโหลด...' : 'เลือกรูป'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={onPickImage}
                />
              </label>
              {imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue('imageUrl', '')}
                >
                  ลบรูป
                </Button>
              ) : null}
              <span className="text-xs text-subtle">JPG, PNG หรือ WebP ไม่เกิน 2 MB</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="specVerified"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              ตรวจสเปกกับแหล่งอ้างอิงแล้ว (ถ้าไม่ติ๊ก จะมีสถานะ &quot;รอตรวจสอบ&quot;)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              แสดงบนหน้าเว็บ
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สเปก</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => {
            const id = `spec-${field.key}`;
            const error = specError(field.key);
            const name = `spec.${field.key}` as const;
            if (field.kind === 'bool') {
              return (
                <label key={field.key} className="flex items-center gap-2 self-end text-sm md:h-10">
                  <Controller
                    control={control}
                    name={name}
                    render={({ field: control_ }) => (
                      <Checkbox
                        checked={control_.value === true}
                        onCheckedChange={(checked) => control_.onChange(checked === true)}
                      />
                    )}
                  />
                  {field.label}
                </label>
              );
            }
            if (field.kind === 'enum') {
              return (
                <FormField key={field.key} id={id} label={field.label} error={error}>
                  <NativeSelect id={id} aria-invalid={Boolean(error)} {...register(name)}>
                    <option value="">เลือก</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              );
            }
            return (
              <FormField
                key={field.key}
                id={id}
                label={field.label}
                error={error}
                hint={field.hint}
              >
                <Input
                  id={id}
                  inputMode={
                    field.kind === 'int' || field.kind === 'decimal' ? 'decimal' : undefined
                  }
                  className="font-mono md:text-xs"
                  aria-invalid={Boolean(error)}
                  {...register(name)}
                />
              </FormField>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || uploading}>
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกอะไหล่'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
