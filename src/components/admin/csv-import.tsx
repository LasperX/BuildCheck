'use client';

import { CircleCheck, CircleX, Clock, Download } from 'lucide-react';
import { useState, useTransition } from 'react';

import { FormAlert, FormField } from '@/components/auth/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CsvParseResult } from '@/lib/parts/csv';
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug } from '@/lib/parts/spec-fields';
import { importPartsCsv, previewPartsCsv } from '@/server/actions/admin-parts';

export function CsvImport() {
  const [category, setCategory] = useState<CategorySlug>('cpu');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [result, setResult] = useState<{ variant: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const formData = () => {
    const data = new FormData();
    data.set('category', category);
    if (file) data.set('file', file);
    return data;
  };

  function reset() {
    setPreview(null);
    setResult(null);
  }

  function runPreview() {
    start(async () => {
      setResult(null);
      setPreview(await previewPartsCsv(formData()));
    });
  }

  function runImport() {
    start(async () => {
      const done = await importPartsCsv(formData());
      if (done.ok) {
        setResult({ variant: 'ok', text: `นำเข้าแล้ว ${done.imported} รายการ` });
        setPreview(null);
        setFile(null);
      } else {
        setResult({ variant: 'err', text: done.error });
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="category" label="หมวด">
              <NativeSelect
                id="category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as CategorySlug);
                  reset();
                }}
              >
                {CATEGORY_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {CATEGORY_LABELS[slug]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="file" label="ไฟล์ CSV" hint="UTF-8 ไม่เกิน 2 MB และไม่เกิน 1,000 แถว">
              <input
                id="file"
                type="file"
                accept=".csv,text/csv"
                className="h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-xs file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-medium"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  reset();
                }}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!file || pending} onClick={runPreview}>
              {pending ? 'กำลังตรวจ...' : 'ตรวจไฟล์'}
            </Button>
            <Button asChild variant="secondary">
              <a href={`/admin/parts/import/template/${category}`}>
                <Download />
                ไฟล์ตัวอย่าง {CATEGORY_LABELS[category]}
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            คอลัมน์ verified ใส่ &quot;รอตรวจสอบ&quot; หรือ &quot;ตรวจแล้ว&quot; · หลายค่าคั่นด้วย |
            · ยี่ห้อต้องมีในระบบก่อน
          </p>
        </CardContent>
      </Card>

      {result ? (
        <div className="max-w-3xl">
          <FormAlert
            variant={result.variant}
            icon={result.variant === 'ok' ? <CircleCheck /> : <CircleX />}
          >
            {result.text}
          </FormAlert>
        </div>
      ) : null}

      {preview && !preview.ok ? (
        <div className="max-w-3xl">
          <FormAlert variant="err" icon={<CircleX />}>
            {preview.error}
          </FormAlert>
        </div>
      ) : null}

      {preview?.ok ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="ok">
              <CircleCheck />
              ผ่าน {preview.validCount} แถว
            </Badge>
            {preview.errorCount > 0 ? (
              <Badge variant="err">
                <CircleX />
                ผิด {preview.errorCount} แถว
              </Badge>
            ) : null}
            <Button disabled={pending || preview.errorCount > 0} onClick={runImport}>
              {pending ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${preview.validCount} รายการ`}
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">แถว</TableHead>
                  <TableHead>รุ่น</TableHead>
                  <TableHead>ผลตรวจ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.row}>
                    <TableCell className="font-mono text-xs">{row.row}</TableCell>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="whitespace-normal">
                      {!row.ok ? (
                        <ul className="flex flex-col gap-0.5 text-xs text-err-fg">
                          {row.errors.map((error) => (
                            <li key={error} className="flex items-start gap-1">
                              <CircleX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                              {error}
                            </li>
                          ))}
                        </ul>
                      ) : row.verified ? (
                        <Badge variant="ok">
                          <CircleCheck />
                          ผ่าน · ตรวจแล้ว
                        </Badge>
                      ) : (
                        <Badge variant="warn">
                          <Clock />
                          ผ่าน · รอตรวจสอบ
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
